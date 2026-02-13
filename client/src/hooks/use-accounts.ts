import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateAccountRequest } from "@shared/routes";
import { z } from "zod";

type DepositRequest = z.infer<typeof api.transactions.deposit.input>;
type TransferRequest = z.infer<typeof api.transactions.transfer.input>;
type BillPayRequest = z.infer<typeof api.transactions.billpay.input>;

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

export function useAccounts() {
  return useQuery({
    queryKey: [api.accounts.list.path],
    queryFn: async () => {
      const res = await fetch(api.accounts.list.path);
      return handleResponse(res, api.accounts.list.responses[200]);
    },
  });
}

export function useAccount(id: number) {
  return useQuery({
    queryKey: [api.accounts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.accounts.get.path, { id });
      const res = await fetch(url);
      return handleResponse(res, api.accounts.get.responses[200]);
    },
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAccountRequest) => {
      const res = await fetch(api.accounts.create.path, {
        method: api.accounts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse(res, api.accounts.create.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

export function useAccountLookup(accountNumber: string) {
  return useQuery({
    queryKey: [api.accounts.getByNumber.path, accountNumber],
    queryFn: async () => {
      const url = buildUrl(api.accounts.getByNumber.path, { accountNumber });
      const res = await fetch(url);
      if (res.status === 404) return null;
      return handleResponse(res, api.accounts.getByNumber.responses[200]);
    },
    enabled: accountNumber.length >= 10,
    retry: false,
  });
}

export function useTransactions(accountId?: number) {
  return useQuery({
    queryKey: [api.transactions.list.path, accountId],
    queryFn: async () => {
      let url = api.transactions.list.path;
      if (accountId) {
        url += `?accountId=${accountId}`;
      }
      const res = await fetch(url);
      return handleResponse(res, api.transactions.list.responses[200]);
    },
  });
}

export function useDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: DepositRequest) => {
      const res = await fetch(api.transactions.deposit.path, {
        method: api.transactions.deposit.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse(res, api.transactions.deposit.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
    },
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TransferRequest) => {
      const res = await fetch(api.transactions.transfer.path, {
        method: api.transactions.transfer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse(res, api.transactions.transfer.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
    },
  });
}

export function useBillPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BillPayRequest) => {
      const res = await fetch(api.transactions.billpay.path, {
        method: api.transactions.billpay.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse(res, api.transactions.billpay.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
    },
  });
}
