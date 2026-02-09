import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), 
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["member", "staff"] }).default("member").notNull(),
  status: text("status", { enum: ["active", "frozen"] }).default("active").notNull(),
  memberNumber: text("member_number").unique(), // Unique CU Identifier
  createdAt: timestamp("created_at").defaultNow(),
});

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type", { enum: ["checking", "share_savings"] }).notNull(),
  initialDeposit: decimal("initial_deposit", { precision: 15, scale: 2 }),
  ssnLast4: text("ssn_last_4").notNull(),
  dob: date("dob").notNull(),
  address: text("address").notNull(),
  idType: text("id_type").notNull(),
  idNumber: text("id_number").notNull(),
  employment: text("employment"),
  status: text("status", { enum: ["submitted", "under_review", "approved", "rejected"] }).default("submitted").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  type: text("type", { enum: ["checking", "share_savings"] }).notNull(),
  currency: text("currency").default("USD").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  status: text("status", { enum: ["active", "closed"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  cardNumber: text("card_number").notNull().unique(), // Masked or encrypted in real app
  expiryDate: text("expiry_date").notNull(),
  status: text("status", { enum: ["active", "frozen", "replaced"] }).default("active").notNull(),
  dailyLimit: decimal("daily_limit", { precision: 15, scale: 2 }).default("1000.00").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  type: text("type", { enum: [
    "deposit_cash", "deposit_mobile", "withdrawal_cash", "transfer_internal", 
    "billpay", "fee", "adjustment_credit", "adjustment_debit", "reversal"
  ] }).notNull(),
  direction: text("direction", { enum: ["credit", "debit"] }).notNull(),
  channel: text("channel", { enum: ["web", "admin", "mobile_deposit"] }).default("web").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  fromAccountId: integer("from_account_id"),
  toAccountId: integer("to_account_id"),
  narration: text("narration"),
  status: text("status", { enum: ["pending", "posted", "reversed", "failed"] }).default("pending").notNull(),
  staffUserId: integer("staff_user_id"), // Record if staff performed action
  reasonCode: text("reason_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id"),
  action: text("action").notNull(), 
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  applications: many(applications),
  auditLogs: many(auditLogs),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  cards: many(cards),
  outgoingTransactions: many(transactions, { relationName: "fromAccount" }),
  incomingTransactions: many(transactions, { relationName: "toAccount" }),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
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
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, memberNumber: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, status: true, rejectionReason: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, accountNumber: true, balance: true, status: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
