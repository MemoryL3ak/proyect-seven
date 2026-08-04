import { apiFetch } from "@/lib/api";

export type PortalAccountKind = "athlete" | "driver" | "staff";

/**
 * Baja de cuenta para los portales con login por código (usuario, conductor,
 * control de acceso). El código (últimos 6 del id) viaja como confirmación de
 * identidad — el mismo nivel de autenticación que usa el login.
 */
export async function deletePortalAccount(
  kind: PortalAccountKind,
  userId: string,
): Promise<void> {
  await apiFetch("/m/auth/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, userId, code: userId.slice(-6) }),
  });
}
