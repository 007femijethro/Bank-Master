import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
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
  memberNumber: text("member_number").unique(),
  dashboardWidgets: jsonb("dashboard_widgets").$type<string[]>().default(["balance", "routing", "activity", "cards"]).notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accountApplications = pgTable("account_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type", { enum: ["share_savings", "checking"] }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  type: text("type", { enum: ["share_savings", "checking"] }).notNull(),
  currency: text("currency").default("USD").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  status: text("status", { enum: ["active", "closed"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  type: text("type", { enum: ["deposit", "transfer", "billpay", "adjustment_credit", "adjustment_debit"] }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  fromAccountId: integer("from_account_id"),
  toAccountId: integer("to_account_id"),
  narration: text("narration"),
  reasonCode: text("reason_code"),
  staffUserId: integer("staff_user_id"),
  status: text("status", { enum: ["pending", "success", "failed"] }).default("pending").notNull(),
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
  applications: many(accountApplications),
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

export const accountApplicationsRelations = relations(accountApplications, ({ one }) => ({
  user: one(users, {
    fields: [accountApplications.userId],
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
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, accountNumber: true, balance: true, status: true });
export const insertApplicationSchema = createInsertSchema(accountApplications).omit({ id: true, createdAt: true, status: true, rejectionReason: true });

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AccountApplication = typeof accountApplications.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
