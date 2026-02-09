import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type AdminUpdateUserStatusRequest } from "@shared/routes";
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
      const res = await fetch(api.admin.users.path, { credentials: "include" });
      return handleResponse(res, api.admin.users.responses[200]);
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number } & AdminUpdateUserStatusRequest) => {
      const url = buildUrl(api.admin.updateUserStatus.path, { id });
      const res = await fetch(url, {
        method: api.admin.updateUserStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
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
      const res = await fetch(api.admin.auditLogs.path, { credentials: "include" });
      return handleResponse(res, api.admin.auditLogs.responses[200]);
    },
  });
}
