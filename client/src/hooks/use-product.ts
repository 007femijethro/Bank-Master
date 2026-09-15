import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

async function json(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export function useBeneficiaries() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: [api.beneficiaries.list.path], queryFn: () => fetch(api.beneficiaries.list.path).then(json) });
  const create = useMutation({ mutationFn: (body: { nickname: string; accountNumber: string }) => fetch(api.beneficiaries.create.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json), onSuccess: () => client.invalidateQueries({ queryKey: [api.beneficiaries.list.path] }) });
  const remove = useMutation({ mutationFn: (id: number) => fetch(`/api/beneficiaries/${id}`, { method: "DELETE" }).then(res => { if (!res.ok) throw new Error("Could not remove beneficiary"); }), onSuccess: () => client.invalidateQueries({ queryKey: [api.beneficiaries.list.path] }) });
  return { ...query, create, remove };
}

export function useNotifications() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: [api.notifications.list.path], queryFn: () => fetch(api.notifications.list.path).then(json) });
  const markRead = useMutation({ mutationFn: (id: number) => fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).then(json), onSuccess: () => client.invalidateQueries({ queryKey: [api.notifications.list.path] }) });
  const remove = useMutation({ mutationFn: (id: number) => fetch(`/api/notifications/${id}`, { method: "DELETE" }).then(res => { if (!res.ok) throw new Error("Could not delete notification"); }), onSuccess: () => client.invalidateQueries({ queryKey: [api.notifications.list.path] }) });
  return { ...query, markRead, remove };
}
