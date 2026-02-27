import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, json, varchar, index } from "drizzle-orm/pg-core";
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
  dateOfBirth: text("date_of_birth"),
  ssnLast4: text("ssn_last4"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  role: text("role", { enum: ["member", "staff"] }).default("member").notNull(),
  status: text("status", { enum: ["active", "frozen", "pending"] }).default("pending").notNull(),
  memberNumber: text("member_number").unique(),
  dashboardWidgets: jsonb("dashboard_widgets").$type<string[]>().default(["balance", "routing", "activity", "cards"]).notNull(),
  avatarUrl: text("avatar_url"),
  kycStatus: text("kyc_status", { enum: ["pending", "verified", "rejected"] }).default("pending").notNull(),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accountApplications = pgTable("account_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type", { enum: ["share_savings", "checking", "loan", "home_equity", "credit_card"] }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  riskScore: integer("risk_score").default(0).notNull(),
  underwritingDecisionReason: text("underwriting_decision_reason"),
  adverseActionNote: text("adverse_action_note"),
  formData: jsonb("form_data").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  type: text("type", { enum: ["share_savings", "checking"] }).notNull(),
  currency: text("currency").default("USD").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  availableBalance: decimal("available_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  status: text("status", { enum: ["active", "closed"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  type: text("type", { enum: ["deposit", "transfer", "billpay", "adjustment_credit", "adjustment_debit", "mobile_deposit", "credit_card_purchase", "credit_card_payment"] }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  fromAccountId: integer("from_account_id"),
  toAccountId: integer("to_account_id"),
  creditCardId: integer("credit_card_id"),
  rail: text("rail", { enum: ["internal", "ach", "wire", "card"] }).default("internal").notNull(),
  effectiveDate: timestamp("effective_date"),
  postedAt: timestamp("posted_at"),
  parentTransactionId: integer("parent_transaction_id"),
  merchantName: text("merchant_name"),
  counterparty: text("counterparty"),
  narration: text("narration"),
  reasonCode: text("reason_code"),
  staffUserId: integer("staff_user_id"),
  status: text("status", { enum: ["pending", "posted", "reversed", "returned", "success", "failed"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const holds = pgTable("holds", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["active", "released"] }).default("active").notNull(),
  releaseAt: timestamp("release_at"),
  releasedBy: integer("released_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statements = pgTable("statements", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).notNull(),
  closingBalance: decimal("closing_balance", { precision: 15, scale: 2 }).notNull(),
  artifactUrl: text("artifact_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditCards = pgTable("credit_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  applicationId: integer("application_id"),
  cardNumber: text("card_number").notNull(),
  lastFour: text("last_four").notNull(),
  cardholderName: text("cardholder_name").notNull(),
  cardType: text("card_type", { enum: ["rewards", "travel", "low_interest", "secured", "student"] }).notNull(),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  apr: decimal("apr", { precision: 5, scale: 2 }).notNull(),
  cvv: text("cvv").notNull(),
  expirationMonth: integer("expiration_month").notNull(),
  expirationYear: integer("expiration_year").notNull(),
  status: text("status", { enum: ["active", "frozen", "closed", "pending_activation"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mobileDeposits = pgTable("mobile_deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  checkFrontUrl: text("check_front_url").notNull(),
  checkBackUrl: text("check_back_url"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  reviewedBy: integer("reviewed_by"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cryptoHoldings = pgTable("crypto_holdings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).default("0").notNull(),
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at").defaultNow(),
});


export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => ({
  expireIdx: index("IDX_session_expire").on(table.expire),
}));

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  correlationId: text("correlation_id"),
  actorUserId: integer("actor_user_id"),
  actorType: text("actor_type", { enum: ["member", "staff", "system"] }).default("system").notNull(),
  action: text("action").notNull(), 
  ipAddress: text("ip_address"),
  requestMetadata: jsonb("request_metadata"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  applications: many(accountApplications),
  auditLogs: many(auditLogs),
  mobileDeposits: many(mobileDeposits),
  cryptoHoldings: many(cryptoHoldings),
  creditCards: many(creditCards),
  notifications: many(notifications),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  outgoingTransactions: many(transactions, { relationName: "fromAccount" }),
  incomingTransactions: many(transactions, { relationName: "toAccount" }),
  holds: many(holds),
  statements: many(statements),
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
  creditCard: one(creditCards, {
    fields: [transactions.creditCardId],
    references: [creditCards.id],
  }),
  parentTransaction: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
  }),
}));

export const holdsRelations = relations(holds, ({ one }) => ({
  account: one(accounts, {
    fields: [holds.accountId],
    references: [accounts.id],
  }),
}));

export const statementsRelations = relations(statements, ({ one }) => ({
  account: one(accounts, {
    fields: [statements.accountId],
    references: [accounts.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const creditCardsRelations = relations(creditCards, ({ one, many }) => ({
  user: one(users, {
    fields: [creditCards.userId],
    references: [users.id],
  }),
  application: one(accountApplications, {
    fields: [creditCards.applicationId],
    references: [accountApplications.id],
  }),
  transactions: many(transactions),
}));

export const mobileDepositsRelations = relations(mobileDeposits, ({ one }) => ({
  user: one(users, {
    fields: [mobileDeposits.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [mobileDeposits.accountId],
    references: [accounts.id],
  }),
}));

export const cryptoHoldingsRelations = relations(cryptoHoldings, ({ one }) => ({
  user: one(users, {
    fields: [cryptoHoldings.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, memberNumber: true }).extend({
  dashboardWidgets: z.array(z.string()).optional(),
});
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, accountNumber: true, balance: true, status: true });
export const insertApplicationSchema = createInsertSchema(accountApplications).omit({ id: true, createdAt: true, status: true, rejectionReason: true, riskScore: true, underwritingDecisionReason: true, adverseActionNote: true });
export const insertCreditCardSchema = createInsertSchema(creditCards).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AccountApplication = typeof accountApplications.$inferSelect;
export type MobileDeposit = typeof mobileDeposits.$inferSelect;
export type CryptoHolding = typeof cryptoHoldings.$inferSelect;
export type CreditCard = typeof creditCards.$inferSelect;
export type Hold = typeof holds.$inferSelect;
export type Statement = typeof statements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
