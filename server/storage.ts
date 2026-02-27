import { users, accounts, transactions, auditLogs, accountApplications, mobileDeposits, cryptoHoldings, creditCards, holds, statements, notifications, type User, type InsertUser, type Account, type Transaction, type AuditLog, type AccountApplication, type InsertApplication, type MobileDeposit, type CryptoHolding, type CreditCard, type Hold, type Statement, type Notification } from "@shared/schema";
import { db } from "./db";
import { eq, or, desc, and, inArray } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);


type TransferRail = "internal" | "ach" | "wire" | "card";

const TRANSFER_RAIL_CONFIG: Record<TransferRail, { settlementHours: number; cutoffHourUtc: number; maxAmount: number; feeAmount: number }> = {
  internal: { settlementHours: 0, cutoffHourUtc: 23, maxAmount: 100000, feeAmount: 0 },
  ach: { settlementHours: 24, cutoffHourUtc: 21, maxAmount: 25000, feeAmount: 0 },
  wire: { settlementHours: 2, cutoffHourUtc: 20, maxAmount: 100000, feeAmount: 15 },
  card: { settlementHours: 1, cutoffHourUtc: 23, maxAmount: 5000, feeAmount: 1.5 },
};

function buildSettlementDate(rail: TransferRail): Date {
  const now = new Date();
  const cfg = TRANSFER_RAIL_CONFIG[rail];
  const estimate = new Date(now.getTime() + cfg.settlementHours * 60 * 60 * 1000);
  if (now.getUTCHours() >= cfg.cutoffHourUtc) {
    estimate.setUTCDate(estimate.getUTCDate() + 1);
  }
  return estimate;
}

function toAmount(value: string | number): number {
  return Number.parseFloat(String(value));
}

function fixed2(value: number): string {
  return value.toFixed(2);
}

const WALLET_PREFIXES: Record<string, string> = {
  BTC: "bc1q", ETH: "0x", SOL: "", ADA: "addr1", DOT: "1", LINK: "0x", XRP: "r", DOGE: "D"
};

function generateWalletAddress(symbol: string): string {
  const prefix = WALLET_PREFIXES[symbol] || "0x";
  const hexChars = "abcdef0123456789";
  const len = symbol === "BTC" ? 38 : symbol === "SOL" ? 44 : symbol === "ADA" ? 58 : 40;
  let addr = prefix;
  for (let i = 0; i < len - prefix.length; i++) {
    addr += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return addr;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: "active" | "frozen" | "locked"): Promise<User>;
  getAllUsers(): Promise<User[]>;

  getAccount(id: number): Promise<Account | undefined>;
  getAccountByNumber(accountNumber: string): Promise<Account | undefined>;
  getAccountsByUserId(userId: number): Promise<Account[]>;
  createAccount(userId: number, type: "share_savings" | "checking"): Promise<Account>;
  
  createApplication(app: InsertApplication & { userId: number }): Promise<AccountApplication>;
  getApplications(): Promise<AccountApplication[]>;
  getApplicationsByUserId(userId: number): Promise<AccountApplication[]>;
  updateApplicationStatus(id: number, status: "approved" | "rejected", reason?: string): Promise<AccountApplication>;

  getTransactionsByAccountId(accountId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  getPendingTransactionsByTypes(types: Array<"deposit" | "billpay">): Promise<Transaction[]>;
  postPendingTransactionsForSettlement(): Promise<number>;
  
  deposit(accountId: number, amount: string, narration?: string): Promise<Transaction>;
  transfer(fromAccountId: number, toAccountNumber: string, amount: string, narration?: string, rail?: TransferRail): Promise<Transaction>;
  billpay(fromAccountId: number, billerType: string, amount: string, narration?: string): Promise<Transaction>;
  reviewTransaction(id: number, status: "approved" | "rejected", reviewedBy: number, reason?: string): Promise<Transaction>;
  adjustBalance(accountId: number, amount: string, type: "adjustment_credit" | "adjustment_debit", staffUserId: number, reasonCode: string, narration?: string): Promise<Transaction>;

  createMobileDeposit(userId: number, accountId: number, amount: string, checkFrontUrl: string, checkBackUrl?: string): Promise<MobileDeposit>;
  getMobileDepositsByUserId(userId: number): Promise<MobileDeposit[]>;
  getAllMobileDeposits(): Promise<MobileDeposit[]>;
  reviewMobileDeposit(id: number, status: "approved" | "rejected", reviewedBy: number, reason?: string): Promise<MobileDeposit>;

  getCryptoHoldingsByUserId(userId: number): Promise<CryptoHolding[]>;
  getCryptoHoldingByWalletAddress(walletAddress: string): Promise<CryptoHolding | undefined>;
  buyCrypto(userId: number, symbol: string, name: string, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding>;
  sellCrypto(holdingId: number, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding>;
  sendCrypto(senderId: number, holdingId: number, amountCrypto: string, recipientId: number): Promise<void>;

  getCreditCardsByUserId(userId: number): Promise<CreditCard[]>;
  getCreditCard(id: number): Promise<CreditCard | undefined>;
  getAllCreditCards(): Promise<CreditCard[]>;
  createCreditCard(userId: number, applicationId: number, cardType: string, creditLimit: string, cardholderName: string): Promise<CreditCard>;
  creditCardPurchase(cardId: number, amount: string, merchant: string): Promise<Transaction>;
  creditCardPayment(cardId: number, fromAccountId: number, amount: string): Promise<Transaction>;
  getTransactionsByCreditCardId(cardId: number): Promise<Transaction[]>;

  createHold(accountId: number, amount: string, reason: string, releaseAt?: Date): Promise<Hold>;
  releaseHold(id: number, releasedBy: number): Promise<Hold>;
  getHoldsByAccountId(accountId: number): Promise<Hold[]>;

  createStatement(accountId: number, periodStart: Date, periodEnd: Date): Promise<Statement>;
  getStatementsByAccountId(accountId: number): Promise<Statement[]>;

  createNotification(userId: number, eventType: string, message: string, metadata?: any): Promise<Notification>;
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  markNotificationRead(id: number, userId: number): Promise<Notification>;

  createAuditLog(actorUserId: number | undefined, action: string, ipAddress?: string, metadata?: any): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;

  hashPassword(password: string): Promise<string>;
  comparePasswords(supplied: string, stored: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const memberNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
    const [user] = await db.insert(users).values({ ...insertUser, memberNumber }).returning();
    return user;
  }

  async updateUserStatus(id: number, status: "active" | "frozen" | "locked"): Promise<User> {
    const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async getAccountByNumber(accountNumber: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber));
    return account;
  }

  async getAccountsByUserId(userId: number): Promise<Account[]> {
    return await db.select().from(accounts).where(eq(accounts.userId, userId));
  }

  async createAccount(userId: number, type: "share_savings" | "checking"): Promise<Account> {
    let accountNumber = "";
    let isUnique = false;
    while (!isUnique) {
      accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const existing = await this.getAccountByNumber(accountNumber);
      if (!existing) isUnique = true;
    }

    const [account] = await db.insert(accounts).values({
      userId,
      accountNumber,
      type,
      currency: "USD",
      balance: "0.00",
      availableBalance: "0.00",
      status: "active"
    }).returning();
    return account;
  }

  async createApplication(app: InsertApplication & { userId: number }): Promise<AccountApplication> {
    const formData = app.formData || {};
    const annualIncome = Number(formData.annualIncome || 0);
    const existingDebt = Number(formData.existingDebt || 0);
    const requestedLimit = Number(formData.requestedLimit || 0);
    const dti = annualIncome > 0 ? ((existingDebt + requestedLimit) / annualIncome) : 1;
    const riskScore = Math.min(100, Math.round(dti * 100));

    const autoReject = app.type === "credit_card" && (annualIncome <= 0 || dti > 0.55);
    const status = autoReject ? "rejected" : "pending";
    const underwritingDecisionReason = autoReject
      ? `Auto-rejected: DTI ${(dti * 100).toFixed(1)}% exceeds policy threshold`
      : `Pending underwriter review. Estimated DTI ${(dti * 100).toFixed(1)}%`;

    const [application] = await db.insert(accountApplications).values({
      ...app,
      status,
      riskScore,
      underwritingDecisionReason,
      adverseActionNote: autoReject ? "Please reduce existing obligations or request a lower credit amount and reapply." : null,
      rejectionReason: autoReject ? "Debt-to-income ratio too high for requested product." : null,
    }).returning();
    return application;
  }

  async getApplications(): Promise<AccountApplication[]> {
    return await db.select().from(accountApplications).orderBy(desc(accountApplications.createdAt));
  }

  async getApplicationsByUserId(userId: number): Promise<AccountApplication[]> {
    return await db.select().from(accountApplications).where(eq(accountApplications.userId, userId)).orderBy(desc(accountApplications.createdAt));
  }

  async updateApplicationStatus(id: number, status: "approved" | "rejected", reason?: string): Promise<AccountApplication> {
    return await db.transaction(async (tx) => {
      const [app] = await tx.update(accountApplications)
        .set({ status, rejectionReason: reason })
        .where(eq(accountApplications.id, id))
        .returning();
      
      if (status === "approved" && (app.type === "share_savings" || app.type === "checking")) {
        await this.createAccount(app.userId, app.type as any);
      }

      if (status === "approved" && app.type === "credit_card") {
        const formData = app.formData || {};
        const cardType = formData.cardType || "rewards";
        const limit = formData.requestedLimit || "5000";
        const user = await this.getUser(app.userId);
        const cardholderName = user?.fullName || "Redbird FCU Member";
        await this.createCreditCard(app.userId, app.id, cardType, limit, cardholderName);
      }

      return app;
    });
  }

  async getTransactionsByAccountId(accountId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(or(eq(transactions.fromAccountId, accountId), eq(transactions.toAccountId, accountId)))
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getPendingTransactionsByTypes(types: Array<"deposit" | "billpay">): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(and(inArray(transactions.type, types), eq(transactions.status, "pending")))
      .orderBy(desc(transactions.createdAt));
  }

  async postPendingTransactionsForSettlement(): Promise<number> {
    const pending = await db.select().from(transactions)
      .where(eq(transactions.status, "pending"));

    let count = 0;
    for (const row of pending) {
      if (["deposit", "billpay", "transfer", "fee_assessment"].includes(row.type)) {
        await this.reviewTransaction(row.id, "approved", 0, "Auto-posted settlement");
        count += 1;
      }
    }
    return count;
  }

  async deposit(accountId: number, amount: string, narration?: string): Promise<Transaction> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account) throw new Error("Account not found");
    const [transaction] = await db.insert(transactions).values({
      reference: `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: "deposit",
      amount,
      toAccountId: accountId,
      rail: "ach",
      effectiveDate: new Date(),
      narration: narration || "Deposit",
      status: "pending"
    }).returning();
    return transaction;
  }

  async transfer(fromAccountId: number, toAccountNumber: string, amount: string, narration?: string, rail: TransferRail = "internal"): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [fromAccount] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId));
      const [toAccount] = await tx.select().from(accounts).where(eq(accounts.accountNumber, toAccountNumber));
      if (!fromAccount || !toAccount) throw new Error("Account not found");
      const amt = toAmount(amount);
      const cfg = TRANSFER_RAIL_CONFIG[rail];
      if (!cfg) throw new Error("Unsupported transfer rail");
      if (amt > cfg.maxAmount) throw new Error(`Amount exceeds ${rail.toUpperCase()} transfer limit of $${cfg.maxAmount.toFixed(2)}`);

      const fee = cfg.feeAmount;
      const totalDebit = amt + fee;
      if (toAmount(fromAccount.availableBalance) < totalDebit) throw new Error("Insufficient available funds");

      const pendingSettlement = rail !== "internal";
      const newFromAvailable = fixed2(toAmount(fromAccount.availableBalance) - totalDebit);
      await tx.update(accounts).set({ availableBalance: newFromAvailable }).where(eq(accounts.id, fromAccountId));

      if (!pendingSettlement) {
        const newFromBalance = fixed2(toAmount(fromAccount.balance) - totalDebit);
        const newToBalance = fixed2(toAmount(toAccount.balance) + amt);
        const newToAvailable = fixed2(toAmount(toAccount.availableBalance) + amt);
        await tx.update(accounts).set({ balance: newFromBalance }).where(eq(accounts.id, fromAccountId));
        await tx.update(accounts).set({ balance: newToBalance, availableBalance: newToAvailable }).where(eq(accounts.id, toAccount.id));
      }

      const settlementEstimatedAt = buildSettlementDate(rail);
      const [transaction] = await tx.insert(transactions).values({
        reference: `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "transfer",
        amount,
        fromAccountId,
        toAccountId: toAccount.id,
        rail,
        effectiveDate: new Date(),
        settlementEstimatedAt,
        postedAt: pendingSettlement ? null : new Date(),
        counterparty: toAccount.accountNumber,
        narration: narration || `Transfer to ${toAccount.accountNumber}`,
        status: pendingSettlement ? "pending" : "posted"
      }).returning();

      if (fee > 0) {
        await tx.insert(transactions).values({
          reference: `FEE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: "fee_assessment",
          amount: fee.toFixed(2),
          fromAccountId,
          rail: "internal",
          effectiveDate: new Date(),
          postedAt: pendingSettlement ? null : new Date(),
          parentTransactionId: transaction.id,
          narration: `${rail.toUpperCase()} transfer fee`,
          reasonCode: `${rail}_fee`,
          status: pendingSettlement ? "pending" : "posted"
        });
      }
      return transaction;
    });
  }

  async billpay(fromAccountId: number, billerType: string, amount: string, narration?: string): Promise<Transaction> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, fromAccountId));
    if (!account) throw new Error("Account not found");

    const [transaction] = await db.insert(transactions).values({
      reference: `BP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: "billpay",
      amount,
      fromAccountId,
      rail: "ach",
      effectiveDate: new Date(),
      narration: narration || `Bill Pay: ${billerType}`,
      status: "pending"
    }).returning();
    return transaction;
  }

  async reviewTransaction(id: number, status: "approved" | "rejected", reviewedBy: number, reason?: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(transactions).where(eq(transactions.id, id));
      if (!existing) throw new Error("Transaction not found");
      if (existing.status !== "pending") throw new Error("Transaction has already been reviewed");
      if (!["deposit", "billpay", "transfer", "fee_assessment"].includes(existing.type)) throw new Error("Only pending deposit, bill pay, transfer, or fee transactions can be reviewed");

      const finalStatus = status === "approved" ? "posted" : "returned";
      const reasonSuffix = reason ? ` (${reason})` : "";
      let updatedNarration = existing.narration || undefined;

      if (status === "approved") {
        if (existing.type === "deposit") {
          if (!existing.toAccountId) throw new Error("Deposit target account is missing");
          const [account] = await tx.select().from(accounts).where(eq(accounts.id, existing.toAccountId));
          if (!account) throw new Error("Account not found");
          const newBalance = fixed2(toAmount(account.balance) + toAmount(existing.amount));
          const newAvailable = fixed2(toAmount(account.availableBalance) + toAmount(existing.amount));
          await tx.update(accounts).set({ balance: newBalance, availableBalance: newAvailable }).where(eq(accounts.id, account.id));
        }

        if (existing.type === "billpay") {
          if (!existing.fromAccountId) throw new Error("Bill pay source account is missing");
          const [account] = await tx.select().from(accounts).where(eq(accounts.id, existing.fromAccountId));
          if (!account) throw new Error("Account not found");
          const amt = toAmount(existing.amount);
          if (toAmount(account.availableBalance) < amt) {
            throw new Error("Insufficient funds at approval time");
          }
          const newBalance = fixed2(toAmount(account.balance) - amt);
          const newAvailable = fixed2(toAmount(account.availableBalance) - amt);
          await tx.update(accounts).set({ balance: newBalance, availableBalance: newAvailable }).where(eq(accounts.id, account.id));
        }

        if (existing.type === "transfer") {
          if (!existing.fromAccountId || !existing.toAccountId) throw new Error("Transfer account details are missing");
          const [fromAccount] = await tx.select().from(accounts).where(eq(accounts.id, existing.fromAccountId));
          const [toAccount] = await tx.select().from(accounts).where(eq(accounts.id, existing.toAccountId));
          if (!fromAccount || !toAccount) throw new Error("Account not found");
          const amt = toAmount(existing.amount);
          const newFromBalance = fixed2(toAmount(fromAccount.balance) - amt);
          const newToBalance = fixed2(toAmount(toAccount.balance) + amt);
          const newToAvailable = fixed2(toAmount(toAccount.availableBalance) + amt);
          await tx.update(accounts).set({ balance: newFromBalance }).where(eq(accounts.id, fromAccount.id));
          await tx.update(accounts).set({ balance: newToBalance, availableBalance: newToAvailable }).where(eq(accounts.id, toAccount.id));
        }

        if (existing.type === "fee_assessment") {
          if (!existing.fromAccountId) throw new Error("Fee source account is missing");
          const [account] = await tx.select().from(accounts).where(eq(accounts.id, existing.fromAccountId));
          if (!account) throw new Error("Account not found");
          const newBalance = fixed2(toAmount(account.balance) - toAmount(existing.amount));
          await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, account.id));
        }

        updatedNarration = `${existing.narration || existing.type} (approved by staff #${reviewedBy})`;
      } else {
        if (existing.type === "transfer" || existing.type === "fee_assessment") {
          if (!existing.fromAccountId) throw new Error("Source account is missing");
          const [account] = await tx.select().from(accounts).where(eq(accounts.id, existing.fromAccountId));
          if (!account) throw new Error("Account not found");
          const newAvailable = fixed2(toAmount(account.availableBalance) + toAmount(existing.amount));
          await tx.update(accounts).set({ availableBalance: newAvailable }).where(eq(accounts.id, account.id));
        }
        updatedNarration = `${existing.narration || existing.type} (rejected by staff #${reviewedBy}${reasonSuffix})`;
      }

      const [updatedTransaction] = await tx.update(transactions)
        .set({ status: finalStatus, narration: updatedNarration, postedAt: status === "approved" ? new Date() : null })
        .where(eq(transactions.id, id))
        .returning();

      return updatedTransaction;
    });
  }

  async adjustBalance(accountId: number, amount: string, type: "adjustment_credit" | "adjustment_debit", staffUserId: number, reasonCode: string, narration?: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      const amt = toAmount(amount);
      let newBalance: string;
      let newAvailable: string;
      if (type === "adjustment_credit") {
        newBalance = fixed2(toAmount(account.balance) + amt);
        newAvailable = fixed2(toAmount(account.availableBalance) + amt);
      } else {
        newBalance = fixed2(toAmount(account.balance) - amt);
        newAvailable = fixed2(toAmount(account.availableBalance) - amt);
      }
      await tx.update(accounts).set({ balance: newBalance, availableBalance: newAvailable }).where(eq(accounts.id, accountId));
      const [transaction] = await tx.insert(transactions).values({
        reference: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        amount,
        toAccountId: type === "adjustment_credit" ? accountId : null,
        fromAccountId: type === "adjustment_debit" ? accountId : null,
        rail: "internal",
        effectiveDate: new Date(),
        postedAt: new Date(),
        narration: narration || `Adjustment: ${reasonCode}`,
        reasonCode,
        staffUserId,
        status: "posted"
      }).returning();
      return transaction;
    });
  }

  async createMobileDeposit(userId: number, accountId: number, amount: string, checkFrontUrl: string, checkBackUrl?: string): Promise<MobileDeposit> {
    const [deposit] = await db.insert(mobileDeposits).values({
      userId,
      accountId,
      amount,
      checkFrontUrl,
      checkBackUrl: checkBackUrl || null,
      status: "pending"
    }).returning();
    return deposit;
  }

  async getMobileDepositsByUserId(userId: number): Promise<MobileDeposit[]> {
    return await db.select().from(mobileDeposits).where(eq(mobileDeposits.userId, userId)).orderBy(desc(mobileDeposits.createdAt));
  }

  async getAllMobileDeposits(): Promise<MobileDeposit[]> {
    return await db.select().from(mobileDeposits).orderBy(desc(mobileDeposits.createdAt));
  }

  async reviewMobileDeposit(id: number, status: "approved" | "rejected", reviewedBy: number, reason?: string): Promise<MobileDeposit> {
    return await db.transaction(async (tx) => {
      const [deposit] = await tx.update(mobileDeposits)
        .set({ status, reviewedBy, rejectionReason: reason })
        .where(eq(mobileDeposits.id, id))
        .returning();

      if (status === "approved") {
        const [account] = await tx.select().from(accounts).where(eq(accounts.id, deposit.accountId));
        if (account) {
          const holdReleaseAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
          const newBalance = fixed2(toAmount(account.balance) + toAmount(deposit.amount));
          await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, deposit.accountId));
          await tx.insert(holds).values({
            accountId: deposit.accountId,
            amount: deposit.amount,
            reason: "Mobile deposit hold",
            releaseAt: holdReleaseAt,
            status: "active",
          });
          await tx.insert(transactions).values({
            reference: `MDEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: "mobile_deposit",
            amount: deposit.amount,
            toAccountId: deposit.accountId,
            rail: "ach",
            effectiveDate: new Date(),
            narration: "Mobile Check Deposit",
            staffUserId: reviewedBy,
            status: "pending"
          });
        }
      }
      return deposit;
    });
  }

  async getCryptoHoldingsByUserId(userId: number): Promise<CryptoHolding[]> {
    const holdings = await db.select().from(cryptoHoldings).where(eq(cryptoHoldings.userId, userId));
    const updates = [];
    for (const h of holdings) {
      if (!h.walletAddress) {
        const addr = generateWalletAddress(h.symbol);
        updates.push(db.update(cryptoHoldings).set({ walletAddress: addr }).where(eq(cryptoHoldings.id, h.id)));
        h.walletAddress = addr;
      }
    }
    if (updates.length > 0) await Promise.all(updates);
    return holdings;
  }

  async getCryptoHoldingByWalletAddress(walletAddress: string): Promise<CryptoHolding | undefined> {
    const [holding] = await db.select().from(cryptoHoldings).where(eq(cryptoHoldings.walletAddress, walletAddress));
    return holding;
  }

  async buyCrypto(userId: number, symbol: string, name: string, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding> {
    return await db.transaction(async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      if (toAmount(account.availableBalance) < toAmount(usdAmount)) throw new Error("Insufficient funds");

      const newBalance = fixed2(toAmount(account.balance) - toAmount(usdAmount));
      const newAvailable = fixed2(toAmount(account.availableBalance) - toAmount(usdAmount));
      await tx.update(accounts).set({ balance: newBalance, availableBalance: newAvailable }).where(eq(accounts.id, accountId));

      await tx.insert(transactions).values({
        reference: `CRYPTO-BUY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "billpay",
        amount: usdAmount,
        fromAccountId: accountId,
        rail: "internal",
        effectiveDate: new Date(),
        postedAt: new Date(),
        narration: `Buy ${cryptoAmount} ${symbol}`,
        status: "posted"
      });

      const existing = await tx.select().from(cryptoHoldings)
        .where(and(eq(cryptoHoldings.userId, userId), eq(cryptoHoldings.symbol, symbol)));

      if (existing.length > 0) {
        const newAmount = (parseFloat(existing[0].amount) + parseFloat(cryptoAmount)).toFixed(8);
        const [updated] = await tx.update(cryptoHoldings)
          .set({ amount: newAmount })
          .where(eq(cryptoHoldings.id, existing[0].id))
          .returning();
        return updated;
      } else {
        const [holding] = await tx.insert(cryptoHoldings).values({
          userId,
          symbol,
          name,
          amount: cryptoAmount,
          walletAddress: generateWalletAddress(symbol),
        }).returning();
        return holding;
      }
    });
  }

  async sellCrypto(holdingId: number, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding> {
    return await db.transaction(async (tx) => {
      const [holding] = await tx.select().from(cryptoHoldings).where(eq(cryptoHoldings.id, holdingId));
      if (!holding) throw new Error("Holding not found");
      if (parseFloat(holding.amount) < parseFloat(cryptoAmount)) throw new Error("Insufficient crypto balance");

      const newAmount = (parseFloat(holding.amount) - parseFloat(cryptoAmount)).toFixed(8);
      const [updated] = await tx.update(cryptoHoldings)
        .set({ amount: newAmount })
        .where(eq(cryptoHoldings.id, holdingId))
        .returning();

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      const newBalance = fixed2(toAmount(account.balance) + toAmount(usdAmount));
      const newAvailable = fixed2(toAmount(account.availableBalance) + toAmount(usdAmount));
      await tx.update(accounts).set({ balance: newBalance, availableBalance: newAvailable }).where(eq(accounts.id, accountId));

      await tx.insert(transactions).values({
        reference: `CRYPTO-SELL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "deposit",
        amount: usdAmount,
        toAccountId: accountId,
        rail: "internal",
        effectiveDate: new Date(),
        postedAt: new Date(),
        narration: `Sell ${cryptoAmount} ${holding.symbol}`,
        status: "posted"
      });

      return updated;
    });
  }

  async sendCrypto(senderId: number, holdingId: number, amountCrypto: string, recipientId: number): Promise<void> {
    return await db.transaction(async (tx) => {
      const amount = parseFloat(amountCrypto);
      if (!isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero");

      const [holding] = await tx.select().from(cryptoHoldings).where(eq(cryptoHoldings.id, holdingId));
      if (!holding) throw new Error("Holding not found");
      if (holding.userId !== senderId) throw new Error("You do not own this holding");
      if (parseFloat(holding.amount) < amount) throw new Error("Insufficient crypto balance");

      const newSenderAmount = (parseFloat(holding.amount) - parseFloat(amountCrypto)).toFixed(8);
      await tx.update(cryptoHoldings)
        .set({ amount: newSenderAmount })
        .where(eq(cryptoHoldings.id, holdingId));

      const existingRecipient = await tx.select().from(cryptoHoldings)
        .where(and(eq(cryptoHoldings.userId, recipientId), eq(cryptoHoldings.symbol, holding.symbol)));

      if (existingRecipient.length > 0) {
        const newRecipientAmount = (parseFloat(existingRecipient[0].amount) + parseFloat(amountCrypto)).toFixed(8);
        await tx.update(cryptoHoldings)
          .set({ amount: newRecipientAmount })
          .where(eq(cryptoHoldings.id, existingRecipient[0].id));
      } else {
        await tx.insert(cryptoHoldings).values({
          userId: recipientId,
          symbol: holding.symbol,
          name: holding.name,
          amount: amountCrypto,
          walletAddress: generateWalletAddress(holding.symbol),
        });
      }
    });
  }

  // === Credit Card Methods ===

  async getCreditCardsByUserId(userId: number): Promise<CreditCard[]> {
    return await db.select().from(creditCards).where(eq(creditCards.userId, userId)).orderBy(desc(creditCards.createdAt));
  }

  async getCreditCard(id: number): Promise<CreditCard | undefined> {
    const [card] = await db.select().from(creditCards).where(eq(creditCards.id, id));
    return card;
  }

  async getAllCreditCards(): Promise<CreditCard[]> {
    return await db.select().from(creditCards).orderBy(desc(creditCards.createdAt));
  }

  async createCreditCard(userId: number, applicationId: number, cardType: string, creditLimit: string, cardholderName: string): Promise<CreditCard> {
    const cardNumber = this.generateCardNumber();
    const lastFour = cardNumber.slice(-4);
    const cvv = Math.floor(100 + Math.random() * 900).toString();
    const now = new Date();
    const expirationMonth = now.getMonth() + 1;
    const expirationYear = now.getFullYear() + 3;

    const aprMap: Record<string, string> = {
      rewards: "18.99",
      travel: "19.99",
      low_interest: "12.49",
      secured: "22.99",
      student: "21.49",
    };
    const apr = aprMap[cardType] || "18.99";

    const [card] = await db.insert(creditCards).values({
      userId,
      applicationId,
      cardNumber,
      lastFour,
      cardholderName: cardholderName.toUpperCase(),
      cardType: cardType as any,
      creditLimit,
      currentBalance: "0.00",
      apr,
      cvv,
      expirationMonth,
      expirationYear,
      status: "active",
    }).returning();
    return card;
  }

  private generateCardNumber(): string {
    const prefix = "4";
    let number = prefix;
    for (let i = 1; i < 15; i++) {
      number += Math.floor(Math.random() * 10).toString();
    }
    let sum = 0;
    let alternate = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let n = parseInt(number[i], 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return number + checkDigit.toString();
  }

  async creditCardPurchase(cardId: number, amount: string, merchant: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [card] = await tx.select().from(creditCards).where(eq(creditCards.id, cardId));
      if (!card) throw new Error("Credit card not found");
      if (card.status !== "active") throw new Error("Credit card is not active");

      const amt = parseFloat(amount);
      const currentBal = parseFloat(card.currentBalance);
      const limit = parseFloat(card.creditLimit);
      const availableCredit = limit - currentBal;

      if (amt > availableCredit) throw new Error("Insufficient credit. Available: $" + availableCredit.toFixed(2));

      const newBalance = (currentBal + amt).toFixed(2);
      await tx.update(creditCards).set({ currentBalance: newBalance }).where(eq(creditCards.id, cardId));

      const [transaction] = await tx.insert(transactions).values({
        reference: `CC-PUR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "credit_card_purchase",
        amount,
        creditCardId: cardId,
        rail: "card",
        merchantName: merchant || "Credit Card Purchase",
        effectiveDate: new Date(),
        postedAt: new Date(),
        narration: merchant || "Credit Card Purchase",
        status: "posted"
      }).returning();
      return transaction;
    });
  }

  async creditCardPayment(cardId: number, fromAccountId: number, amount: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [card] = await tx.select().from(creditCards).where(eq(creditCards.id, cardId));
      if (!card) throw new Error("Credit card not found");

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId));
      if (!account) throw new Error("Account not found");

      const amt = parseFloat(amount);
      if (toAmount(account.availableBalance) < amt) throw new Error("Insufficient funds in source account");

      const currentBal = parseFloat(card.currentBalance);
      const paymentAmount = Math.min(amt, currentBal);

      const newCardBalance = fixed2(currentBal - paymentAmount);
      await tx.update(creditCards).set({ currentBalance: newCardBalance }).where(eq(creditCards.id, cardId));

      const newAccountBalance = fixed2(toAmount(account.balance) - paymentAmount);
      const newAccountAvailable = fixed2(toAmount(account.availableBalance) - paymentAmount);
      await tx.update(accounts).set({ balance: newAccountBalance, availableBalance: newAccountAvailable }).where(eq(accounts.id, fromAccountId));

      const [transaction] = await tx.insert(transactions).values({
        reference: `CC-PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "credit_card_payment",
        amount: paymentAmount.toFixed(2),
        fromAccountId,
        creditCardId: cardId,
        rail: "internal",
        effectiveDate: new Date(),
        postedAt: new Date(),
        narration: `Credit Card Payment - ****${card.lastFour}`,
        status: "posted"
      }).returning();
      return transaction;
    });
  }

  async getTransactionsByCreditCardId(cardId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.creditCardId, cardId))
      .orderBy(desc(transactions.createdAt));
  }

  async createHold(accountId: number, amount: string, reason: string, releaseAt?: Date): Promise<Hold> {
    const [hold] = await db.insert(holds).values({ accountId, amount, reason, releaseAt: releaseAt || null, status: "active" }).returning();
    return hold;
  }

  async releaseHold(id: number, releasedBy: number): Promise<Hold> {
    return await db.transaction(async (tx) => {
      const [hold] = await tx.select().from(holds).where(eq(holds.id, id));
      if (!hold) throw new Error("Hold not found");
      if (hold.status === "released") return hold;

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, hold.accountId));
      if (!account) throw new Error("Account not found");

      const newAvailable = fixed2(toAmount(account.availableBalance) + toAmount(hold.amount));
      await tx.update(accounts).set({ availableBalance: newAvailable }).where(eq(accounts.id, account.id));

      const [updated] = await tx.update(holds)
        .set({ status: "released", releasedBy })
        .where(eq(holds.id, id))
        .returning();
      return updated;
    });
  }

  async getHoldsByAccountId(accountId: number): Promise<Hold[]> {
    return await db.select().from(holds).where(eq(holds.accountId, accountId)).orderBy(desc(holds.createdAt));
  }

  async createStatement(accountId: number, periodStart: Date, periodEnd: Date): Promise<Statement> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account) throw new Error("Account not found");

    const accountTransactions = await db.select().from(transactions)
      .where(and(
        or(eq(transactions.fromAccountId, accountId), eq(transactions.toAccountId, accountId)),
        eq(transactions.status, "posted")
      ));

    let totalCredits = 0;
    let totalDebits = 0;
    for (const tx of accountTransactions) {
      const postedAt = tx.postedAt || tx.createdAt;
      if (!postedAt || postedAt < periodStart || postedAt > periodEnd) continue;
      const amount = toAmount(tx.amount);
      if (tx.toAccountId === accountId) totalCredits += amount;
      if (tx.fromAccountId === accountId) totalDebits += amount;
    }

    const closingBalance = toAmount(account.balance);
    const openingBalance = closingBalance - totalCredits + totalDebits;

    const artifactUrl = `/statements/${accountId}/${periodStart.toISOString().slice(0, 10)}-${periodEnd.toISOString().slice(0, 10)}.html`;
    const [statement] = await db.insert(statements).values({
      accountId,
      periodStart,
      periodEnd,
      openingBalance: fixed2(openingBalance),
      totalCredits: fixed2(totalCredits),
      totalDebits: fixed2(totalDebits),
      closingBalance: fixed2(closingBalance),
      artifactUrl,
    }).returning();
    return statement;
  }

  async getStatementsByAccountId(accountId: number): Promise<Statement[]> {
    return await db.select().from(statements).where(eq(statements.accountId, accountId)).orderBy(desc(statements.createdAt));
  }

  async createNotification(userId: number, eventType: string, message: string, metadata?: any): Promise<Notification> {
    const [notification] = await db.insert(notifications).values({ userId, eventType, message, metadata: metadata || null }).returning();
    return notification;
  }

  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number, userId: number): Promise<Notification> {
    const [notification] = await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    if (!notification) throw new Error("Notification not found");
    return notification;
  }

  async createAuditLog(actorUserId: number | undefined, action: string, ipAddress?: string, metadata?: any): Promise<AuditLog> {
    const eventId = `evt_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const [log] = await db.insert(auditLogs).values({
      eventId,
      correlationId: eventId,
      actorUserId,
      actorType: actorUserId ? "member" : "system",
      action,
      ipAddress,
      requestMetadata: ipAddress ? { ipAddress } : null,
      metadata,
    }).returning();
    return log;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  }
}

export const storage = new DatabaseStorage();
