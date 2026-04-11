import { z } from 'zod';
import { insertUserSchema, users, accounts, transactions, auditLogs, accountApplications, mobileDeposits, cryptoHoldings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  forbidden: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.void(),
      },
    },
    changePassword: {
      method: 'POST' as const,
      path: '/api/user/password' as const,
      input: z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: z.object({ message: z.string() }),
        401: z.void(),
      },
    },
  },
  accounts: {
    list: {
      method: 'GET' as const,
      path: '/api/accounts' as const,
      responses: {
        200: z.array(z.custom<typeof accounts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/accounts/:id' as const,
      responses: {
        200: z.custom<typeof accounts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/accounts' as const,
      input: z.object({
        type: z.enum(["share_savings", "checking", "loan", "home_equity", "credit_card"]),
        formData: z.record(z.any()).optional(),
      }),
      responses: {
        201: z.custom<typeof accountApplications.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    getByNumber: {
      method: 'GET' as const,
      path: '/api/accounts/lookup/:accountNumber' as const,
      responses: {
        200: z.object({ id: z.number(), fullName: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions' as const,
      input: z.object({ accountId: z.coerce.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect>()),
      },
    },
    deposit: {
      method: 'POST' as const,
      path: '/api/transactions/deposit' as const,
      input: z.object({
        accountId: z.number(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
        narration: z.string().optional()
      }),
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    transfer: {
      method: 'POST' as const,
      path: '/api/transactions/transfer' as const,
      input: z.object({
        fromAccountId: z.number(),
        toAccountNumber: z.string(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
        narration: z.string().optional(),
        rail: z.enum(["internal", "ach", "wire", "card"]).optional()
      }),
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    billpay: {
      method: 'POST' as const,
      path: '/api/transactions/billpay' as const,
      input: z.object({
        fromAccountId: z.number(),
        billerType: z.string(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
        narration: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    settlePending: {
      method: 'POST' as const,
      path: '/api/admin/transactions/settle-pending' as const,
      responses: {
        200: z.object({ postedCount: z.number() }),
        403: errorSchemas.forbidden,
      },
    },
  },
  holds: {
    list: {
      method: 'GET' as const,
      path: '/api/accounts/:accountId/holds' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
  },
  statements: {
    list: {
      method: 'GET' as const,
      path: '/api/accounts/:accountId/statements' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/accounts/:accountId/statements' as const,
      input: z.object({
        periodStart: z.string(),
        periodEnd: z.string(),
      }),
      responses: {
        201: z.any(),
      },
    },
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    markRead: {
      method: 'PATCH' as const,
      path: '/api/notifications/:id/read' as const,
      responses: {
        200: z.any(),
      },
    },
  },
  mobileDeposit: {
    create: {
      method: 'POST' as const,
      path: '/api/mobile-deposit' as const,
      input: z.object({
        accountId: z.number(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
        checkFrontUrl: z.string().min(1),
        checkBackUrl: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof mobileDeposits.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/mobile-deposits' as const,
      responses: {
        200: z.array(z.custom<typeof mobileDeposits.$inferSelect>()),
      },
    },
  },
  crypto: {
    holdings: {
      method: 'GET' as const,
      path: '/api/crypto/holdings' as const,
      responses: {
        200: z.array(z.custom<typeof cryptoHoldings.$inferSelect>()),
      },
    },
    buy: {
      method: 'POST' as const,
      path: '/api/crypto/buy' as const,
      input: z.object({
        symbol: z.string(),
        name: z.string(),
        amountUsd: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
        cryptoAmount: z.string(),
        accountId: z.number(),
      }),
      responses: {
        201: z.custom<typeof cryptoHoldings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    sell: {
      method: 'POST' as const,
      path: '/api/crypto/sell' as const,
      input: z.object({
        holdingId: z.number(),
        amountCrypto: z.string(),
        usdAmount: z.string(),
        accountId: z.number(),
      }),
      responses: {
        200: z.custom<typeof cryptoHoldings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    send: {
      method: 'POST' as const,
      path: '/api/crypto/send' as const,
      input: z.object({
        holdingId: z.number(),
        amountCrypto: z.string().regex(/^\d+(\.\d{1,8})?$/, "Invalid crypto amount"),
        recipientIdentifier: z.string().min(1, "Recipient is required"),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
      },
    },
  },
  admin: {
    users: {
      method: 'GET' as const,
      path: '/api/admin/users' as const,
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
        403: errorSchemas.forbidden,
      },
    },
    updateUserStatus: {
      method: 'PATCH' as const,
      path: '/api/admin/users/:id/status' as const,
      input: z.object({ status: z.enum(["active", "frozen", "locked"]) }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        403: errorSchemas.forbidden,
      },
    },
    auditLogs: {
      method: 'GET' as const,
      path: '/api/admin/audit-logs' as const,
      responses: {
        200: z.array(z.custom<typeof auditLogs.$inferSelect>()),
        403: errorSchemas.forbidden,
      },
    },
    memberFinancials: {
      method: 'GET' as const,
      path: '/api/admin/member-financials' as const,
      responses: {
        200: z.array(z.object({
          userId: z.number(),
          totalBalance: z.string(),
          assetCount: z.number(),
          accountCount: z.number(),
          cryptoAssetCount: z.number(),
        })),
        403: errorSchemas.forbidden,
      },
    },
    applications: {
      method: 'GET' as const,
      path: '/api/admin/applications' as const,
      responses: {
        200: z.array(z.custom<typeof accountApplications.$inferSelect>()),
        403: errorSchemas.forbidden,
      },
    },
    updateApplication: {
      method: 'PATCH' as const,
      path: '/api/admin/applications/:id' as const,
      input: z.object({ status: z.enum(["approved", "rejected"]), reason: z.string().optional() }),
      responses: {
        200: z.custom<typeof accountApplications.$inferSelect>(),
        403: errorSchemas.forbidden,
      },
    },
    adjustBalance: {
      method: 'POST' as const,
      path: '/api/admin/adjust-balance' as const,
      input: z.object({
        accountId: z.number(),
        amount: z.string(),
        type: z.enum(["adjustment_credit", "adjustment_debit"]),
        reasonCode: z.string(),
        narration: z.string().optional()
      }),
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        403: errorSchemas.forbidden,
      },
    },
    mobileDeposits: {
      method: 'GET' as const,
      path: '/api/admin/mobile-deposits' as const,
      responses: {
        200: z.array(z.custom<typeof mobileDeposits.$inferSelect>()),
        403: errorSchemas.forbidden,
      },
    },
    reviewMobileDeposit: {
      method: 'PATCH' as const,
      path: '/api/admin/mobile-deposits/:id' as const,
      input: z.object({ status: z.enum(["approved", "rejected"]), reason: z.string().optional() }),
      responses: {
        200: z.custom<typeof mobileDeposits.$inferSelect>(),
        403: errorSchemas.forbidden,
      },
    },
    pendingTransactions: {
      method: 'GET' as const,
      path: '/api/admin/pending-transactions' as const,
      responses: {
        200: z.array(z.any()),
        403: errorSchemas.forbidden,
      },
    },
    reviewTransaction: {
      method: 'PATCH' as const,
      path: '/api/admin/transactions/:id/review' as const,
      input: z.object({ status: z.enum(["approved", "rejected"]), reason: z.string().optional() }),
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        403: errorSchemas.forbidden,
      },
    },
  },
};

export type CreateAccountRequest = z.infer<typeof api.accounts.create.input>;

export type LoginRequest = z.infer<typeof api.auth.login.input>;
export type RegisterUserRequest = z.infer<typeof api.auth.register.input>;
export type DepositRequest = z.infer<typeof api.transactions.deposit.input>;
export type TransferRequest = z.infer<typeof api.transactions.transfer.input>;
export type BillPayRequest = z.infer<typeof api.transactions.billpay.input>;

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
