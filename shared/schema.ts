import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // Hashed
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["customer", "admin"] }).default("customer").notNull(),
  status: text("status", { enum: ["active", "frozen"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Foreign key to users
  accountNumber: text("account_number").notNull().unique(), // 10 digits
  type: text("type", { enum: ["savings", "current"] }).notNull(),
  currency: text("currency").default("NGN").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  status: text("status", { enum: ["active", "closed"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  type: text("type", { enum: ["deposit", "transfer", "billpay"] }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  fromAccountId: integer("from_account_id"), // Nullable for deposit
  toAccountId: integer("to_account_id"),     // Nullable for billpay/withdrawal
  narration: text("narration"),
  status: text("status", { enum: ["pending", "success", "failed"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id"),
  action: text("action").notNull(), // LOGIN, REGISTER, TRANSFER, etc.
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  auditLogs: many(auditLogs),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  outgoingTransactions: many(transactions, { relationName: "fromAccount" }),
  incomingTransactions: many(transactions, { relationName: "toAccount" }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromAccount: one(accounts, {
    fields: [transactions.fromAccountId],
    references: [accounts.id],
    relationName: "fromAccount",
  }),
  toAccount: one(accounts, {
    fields: [transactions.toAccountId],
    references: [accounts.id],
    relationName: "toAccount",
  }),
}));

// === BASE SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, accountNumber: true, balance: true, status: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, status: true, reference: true });

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;

// Request types
export type RegisterUserRequest = InsertUser;
export type LoginRequest = { username: string; password: string }; // Passport uses 'username' field usually

export type CreateAccountRequest = { type: "savings" | "current" };

export type DepositRequest = { accountId: number; amount: string; narration?: string };
export type TransferRequest = { fromAccountId: number; toAccountNumber: string; amount: string; narration?: string };
export type BillPayRequest = { fromAccountId: number; billerType: string; amount: string; narration?: string };

// Response types
export type AuthResponse = User;

export type AccountResponse = Account;
export type TransactionResponse = Transaction;

// Admin types
export type AdminUpdateUserStatusRequest = { status: "active" | "frozen" };
