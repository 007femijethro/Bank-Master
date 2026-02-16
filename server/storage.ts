import { users, accounts, transactions, auditLogs, accountApplications, mobileDeposits, cryptoHoldings, creditCards, type User, type InsertUser, type Account, type Transaction, type AuditLog, type AccountApplication, type InsertApplication, type MobileDeposit, type CryptoHolding, type CreditCard } from "@shared/schema";
import { db } from "./db";
import { eq, or, desc, sql, and } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: "active" | "frozen"): Promise<User>;
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
  
  deposit(accountId: number, amount: string, narration?: string): Promise<Transaction>;
  transfer(fromAccountId: number, toAccountNumber: string, amount: string, narration?: string): Promise<Transaction>;
  billpay(fromAccountId: number, billerType: string, amount: string, narration?: string): Promise<Transaction>;
  adjustBalance(accountId: number, amount: string, type: "adjustment_credit" | "adjustment_debit", staffUserId: number, reasonCode: string, narration?: string): Promise<Transaction>;

  createMobileDeposit(userId: number, accountId: number, amount: string, checkFrontUrl: string, checkBackUrl?: string): Promise<MobileDeposit>;
  getMobileDepositsByUserId(userId: number): Promise<MobileDeposit[]>;
  getAllMobileDeposits(): Promise<MobileDeposit[]>;
  reviewMobileDeposit(id: number, status: "approved" | "rejected", reviewedBy: number, reason?: string): Promise<MobileDeposit>;

  getCryptoHoldingsByUserId(userId: number): Promise<CryptoHolding[]>;
  buyCrypto(userId: number, symbol: string, name: string, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding>;
  sellCrypto(holdingId: number, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding>;

  getCreditCardsByUserId(userId: number): Promise<CreditCard[]>;
  getCreditCard(id: number): Promise<CreditCard | undefined>;
  getAllCreditCards(): Promise<CreditCard[]>;
  createCreditCard(userId: number, applicationId: number, cardType: string, creditLimit: string, cardholderName: string): Promise<CreditCard>;
  creditCardPurchase(cardId: number, amount: string, merchant: string): Promise<Transaction>;
  creditCardPayment(cardId: number, fromAccountId: number, amount: string): Promise<Transaction>;
  getTransactionsByCreditCardId(cardId: number): Promise<Transaction[]>;

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

  async updateUserStatus(id: number, status: "active" | "frozen"): Promise<User> {
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
      status: "active"
    }).returning();
    return account;
  }

  async createApplication(app: InsertApplication & { userId: number }): Promise<AccountApplication> {
    const [application] = await db.insert(accountApplications).values(app).returning();
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

  async deposit(accountId: number, amount: string, narration?: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      const newBalance = (parseFloat(account.balance) + parseFloat(amount)).toFixed(2);
      await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, accountId));
      const [transaction] = await tx.insert(transactions).values({
        reference: `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "deposit",
        amount,
        toAccountId: accountId,
        narration: narration || "Deposit",
        status: "success"
      }).returning();
      return transaction;
    });
  }

  async transfer(fromAccountId: number, toAccountNumber: string, amount: string, narration?: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [fromAccount] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId));
      const [toAccount] = await tx.select().from(accounts).where(eq(accounts.accountNumber, toAccountNumber));
      if (!fromAccount || !toAccount) throw new Error("Account not found");
      const amt = parseFloat(amount);
      if (parseFloat(fromAccount.balance) < amt) throw new Error("Insufficient funds");
      const newFromBalance = (parseFloat(fromAccount.balance) - amt).toFixed(2);
      const newToBalance = (parseFloat(toAccount.balance) + amt).toFixed(2);
      await tx.update(accounts).set({ balance: newFromBalance }).where(eq(accounts.id, fromAccountId));
      await tx.update(accounts).set({ balance: newToBalance }).where(eq(accounts.id, toAccount.id));
      const [transaction] = await tx.insert(transactions).values({
        reference: `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "transfer",
        amount,
        fromAccountId,
        toAccountId: toAccount.id,
        narration: narration || `Transfer to ${toAccount.accountNumber}`,
        status: "success"
      }).returning();
      return transaction;
    });
  }

  async billpay(fromAccountId: number, billerType: string, amount: string, narration?: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId));
      if (!account) throw new Error("Account not found");
      const amt = parseFloat(amount);
      if (parseFloat(account.balance) < amt) throw new Error("Insufficient funds");
      const newBalance = (parseFloat(account.balance) - amt).toFixed(2);
      await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, fromAccountId));
      const [transaction] = await tx.insert(transactions).values({
        reference: `BP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "billpay",
        amount,
        fromAccountId,
        narration: narration || `Bill Pay: ${billerType}`,
        status: "success"
      }).returning();
      return transaction;
    });
  }

  async adjustBalance(accountId: number, amount: string, type: "adjustment_credit" | "adjustment_debit", staffUserId: number, reasonCode: string, narration?: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      const amt = parseFloat(amount);
      let newBalance: string;
      if (type === "adjustment_credit") {
        newBalance = (parseFloat(account.balance) + amt).toFixed(2);
      } else {
        newBalance = (parseFloat(account.balance) - amt).toFixed(2);
      }
      await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, accountId));
      const [transaction] = await tx.insert(transactions).values({
        reference: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        amount,
        toAccountId: type === "adjustment_credit" ? accountId : null,
        fromAccountId: type === "adjustment_debit" ? accountId : null,
        narration: narration || `Adjustment: ${reasonCode}`,
        reasonCode,
        staffUserId,
        status: "success"
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
          const newBalance = (parseFloat(account.balance) + parseFloat(deposit.amount)).toFixed(2);
          await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, deposit.accountId));
          await tx.insert(transactions).values({
            reference: `MDEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: "mobile_deposit",
            amount: deposit.amount,
            toAccountId: deposit.accountId,
            narration: "Mobile Check Deposit",
            staffUserId: reviewedBy,
            status: "success"
          });
        }
      }
      return deposit;
    });
  }

  async getCryptoHoldingsByUserId(userId: number): Promise<CryptoHolding[]> {
    return await db.select().from(cryptoHoldings).where(eq(cryptoHoldings.userId, userId));
  }

  async buyCrypto(userId: number, symbol: string, name: string, cryptoAmount: string, usdAmount: string, accountId: number): Promise<CryptoHolding> {
    return await db.transaction(async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      if (parseFloat(account.balance) < parseFloat(usdAmount)) throw new Error("Insufficient funds");

      const newBalance = (parseFloat(account.balance) - parseFloat(usdAmount)).toFixed(2);
      await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, accountId));

      await tx.insert(transactions).values({
        reference: `CRYPTO-BUY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "billpay",
        amount: usdAmount,
        fromAccountId: accountId,
        narration: `Buy ${cryptoAmount} ${symbol}`,
        status: "success"
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
          amount: cryptoAmount
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
      const newBalance = (parseFloat(account.balance) + parseFloat(usdAmount)).toFixed(2);
      await tx.update(accounts).set({ balance: newBalance }).where(eq(accounts.id, accountId));

      await tx.insert(transactions).values({
        reference: `CRYPTO-SELL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "deposit",
        amount: usdAmount,
        toAccountId: accountId,
        narration: `Sell ${cryptoAmount} ${holding.symbol}`,
        status: "success"
      });

      return updated;
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
        narration: merchant || "Credit Card Purchase",
        status: "success"
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
      if (parseFloat(account.balance) < amt) throw new Error("Insufficient funds in source account");

      const currentBal = parseFloat(card.currentBalance);
      const paymentAmount = Math.min(amt, currentBal);

      const newCardBalance = (currentBal - paymentAmount).toFixed(2);
      await tx.update(creditCards).set({ currentBalance: newCardBalance }).where(eq(creditCards.id, cardId));

      const newAccountBalance = (parseFloat(account.balance) - paymentAmount).toFixed(2);
      await tx.update(accounts).set({ balance: newAccountBalance }).where(eq(accounts.id, fromAccountId));

      const [transaction] = await tx.insert(transactions).values({
        reference: `CC-PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "credit_card_payment",
        amount: paymentAmount.toFixed(2),
        fromAccountId,
        creditCardId: cardId,
        narration: `Credit Card Payment - ****${card.lastFour}`,
        status: "success"
      }).returning();
      return transaction;
    });
  }

  async getTransactionsByCreditCardId(cardId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.creditCardId, cardId))
      .orderBy(desc(transactions.createdAt));
  }

  async createAuditLog(actorUserId: number | undefined, action: string, ipAddress?: string, metadata?: any): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values({ actorUserId, action, ipAddress, metadata }).returning();
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
