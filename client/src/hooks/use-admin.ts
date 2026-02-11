import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
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

export function useAdminUsers() {
  return useQuery({
    queryKey: [api.admin.users.path],
    queryFn: async () => {
      const res = await fetch(api.admin.users.path);
      return handleResponse(res, api.admin.users.responses[200]);
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number, status: "active" | "frozen" }) => {
      const url = buildUrl(api.admin.updateUserStatus.path, { id });
      const res = await fetch(url, {
        method: api.admin.updateUserStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return handleResponse(res, api.admin.updateUserStatus.responses[200]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: [api.admin.auditLogs.path],
    queryFn: async () => {
      const res = await fetch(api.admin.auditLogs.path);
      return handleResponse(res, api.admin.auditLogs.responses[200]);
    },
  });
}

export function useAdminApplications() {
  return useQuery({
    queryKey: [api.admin.applications.path],
    queryFn: async () => {
      const res = await fetch(api.admin.applications.path);
      return handleResponse(res, api.admin.applications.responses[200]);
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: number, status: "approved" | "rejected", reason?: string }) => {
      const url = buildUrl(api.admin.updateApplication.path, { id });
      const res = await fetch(url, {
        method: api.admin.updateApplication.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      return handleResponse(res, api.admin.updateApplication.responses[200]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.applications.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
    },
  });
}

export function useAdjustBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.admin.adjustBalance.input>) => {
      const res = await fetch(api.admin.adjustBalance.path, {
        method: api.admin.adjustBalance.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse(res, api.admin.adjustBalance.responses[200]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
    },
  });
}
