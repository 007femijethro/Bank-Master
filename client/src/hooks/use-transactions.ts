import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

async function handleResponse<T>(res: Response, schema: z.ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    let errorMessage = "An error occurred";
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorMessage;
    } catch { /* ignore */ }
    throw new Error(errorMessage);
  }
  const data = await res.json();
  return schema.parse(data);
}

export function useTransactions(accountId?: number) {
  return useQuery({
    queryKey: [api.transactions.list.path, accountId],
    queryFn: async () => {
      // Build query string manually since backend expects optional query param
      const path = api.transactions.list.path + (accountId ? `?accountId=${accountId}` : "");
      const res = await fetch(path, { credentials: "include" });
      return handleResponse(res, api.transactions.list.responses[200]);
    },
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.transactions.deposit.input>) => {
      const res = await fetch(api.transactions.deposit.path, {
        method: api.transactions.deposit.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(res, api.transactions.deposit.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.transactions.transfer.input>) => {
      const res = await fetch(api.transactions.transfer.path, {
        method: api.transactions.transfer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(res, api.transactions.transfer.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

export function useBillPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.transactions.billpay.input>) => {
      const res = await fetch(api.transactions.billpay.path, {
        method: api.transactions.billpay.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(res, api.transactions.billpay.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}
