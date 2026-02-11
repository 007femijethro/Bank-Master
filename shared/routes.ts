import { z } from 'zod';
import { insertUserSchema, users, accounts, transactions, auditLogs, accountApplications } from './schema';

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
      input: z.object({ type: z.enum(["share_savings", "checking"]) }),
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
        narration: z.string().optional()
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
        narration: z.string().optional()
      }),
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
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
      input: z.object({ status: z.enum(["active", "frozen"]) }),
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
  },
};

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
