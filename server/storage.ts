import { users, accounts, transactions, auditLogs, accountApplications, type User, type InsertUser, type Account, type Transaction, type AuditLog, type AccountApplication, type InsertApplication } from "@shared/schema";
import { db } from "./db";
import { eq, or, desc, sql } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: "active" | "frozen"): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Account
  getAccount(id: number): Promise<Account | undefined>;
  getAccountByNumber(accountNumber: string): Promise<Account | undefined>;
  getAccountsByUserId(userId: number): Promise<Account[]>;
  createAccount(userId: number, type: "share_savings" | "checking"): Promise<Account>;
  
  // Applications
  createApplication(app: InsertApplication & { userId: number }): Promise<AccountApplication>;
  getApplications(): Promise<AccountApplication[]>;
  updateApplicationStatus(id: number, status: "approved" | "rejected", reason?: string): Promise<AccountApplication>;

  // Transaction
  getTransactionsByAccountId(accountId: number): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  
  // Operations
  deposit(accountId: number, amount: string, narration?: string): Promise<Transaction>;
  transfer(fromAccountId: number, toAccountNumber: string, amount: string, narration?: string): Promise<Transaction>;
  billpay(fromAccountId: number, billerType: string, amount: string, narration?: string): Promise<Transaction>;
  adjustBalance(accountId: number, amount: string, type: "adjustment_credit" | "adjustment_debit", staffUserId: number, reasonCode: string, narration?: string): Promise<Transaction>;

  // Audit
  createAuditLog(actorUserId: number | undefined, action: string, ipAddress?: string, metadata?: any): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;

  // Auth Helpers
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

  async updateApplicationStatus(id: number, status: "approved" | "rejected", reason?: string): Promise<AccountApplication> {
    return await db.transaction(async (tx) => {
      const [app] = await tx.update(accountApplications)
        .set({ status, rejectionReason: reason })
        .where(eq(accountApplications.id, id))
        .returning();
      
      if (status === "approved") {
        await this.createAccount(app.userId, app.type as any);
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
