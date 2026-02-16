import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type LoginRequest, type RegisterUserRequest } from "@shared/routes";
import { z } from "zod";

// Helper to handle API validation failures
async function handleResponse<T>(res: Response, schema: z.ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    // Try to parse error message
    let errorMessage = "An error occurred";
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorMessage;
    } catch { /* ignore json parse fail */ }
    throw new Error(errorMessage);
  }
  const data = await res.json();
  return schema.parse(data);
}

export function useAuth() {
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      return handleResponse(res, api.auth.me.responses[200]);
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return handleResponse(res, api.auth.login.responses[200]);
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterUserRequest) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        let errorMessage = "An error occurred";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }
      return res.json();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, { 
        method: api.auth.logout.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    login: loginMutation,
    register: registerMutation,
    logout: logoutMutation,
  };
}
