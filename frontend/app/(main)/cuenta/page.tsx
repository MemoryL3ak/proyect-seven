"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearTokens, getStoredUser } from "@/lib/api";
import { ALL_MODULES } from "@/lib/modules";
import { useI18n } from "@/lib/i18n";

const TEAL = "#21D0B3";

type PanelUser = {
  id?: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, unknown>;
};

const isUsernameAccount = (email?: string) => (email || "").endsWith("@nomail.seven");

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MiCuentaPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<PanelUser | null>(null);

  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // Eliminación de cuenta
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setUser(getStoredUser() as PanelUser | null);
  }, []);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.name === "string" && meta.name.trim() ? meta.name : (user?.email || "Usuario").split("@")[0];
  const role = typeof meta.role === "string" && meta.role.trim() ? meta.role : "Sin rol";
  const isAdmin = role.trim().toLowerCase() === "administrador";
  const username = typeof meta.username === "string" ? meta.username : null;
  const modules = Array.isArray(meta.modules) ? (meta.modules as string[]) : null;

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "U";

  const grantedByGroup = useMemo(() => {
    if (!modules || modules.length === 0) return null;
    const granted = ALL_MODULES.filter((m) => modules.includes(m.id));
    const groups = new Map<string, typeof granted>();
    granted.forEach((m) => {
      const list = groups.get(m.group) ?? [];
      list.push(m);
      groups.set(m.group, list);
    });
    return groups;
  }, [modules]);

  const handleChangePassword = async () => {
    setPwMsg(null);
    setPwError(null);
    if (!currentPassword || !newPassword) { setPwError(t("Completa la contraseña actual y la nueva.")); return; }
    if (newPassword.length < 8) { setPwError(t("La nueva contraseña debe tener al menos 8 caracteres.")); return; }
    if (newPassword !== confirmPassword) { setPwError(t("La confirmación no coincide con la nueva contraseña.")); return; }
    setPwSaving(true);
    try {
      await apiFetch("/auth/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwMsg(t("Contraseña actualizada correctamente."));
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      let msg = err instanceof Error ? err.message : "";
      try { const p = JSON.parse(msg); if (p?.message) msg = p.message; } catch { /* noop */ }
      setPwError(msg || t("No se pudo actualizar la contraseña."));
    } finally {
      setPwSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await apiFetch("/auth/me", { method: "DELETE" });
      clearTokens();
      router.push("/login");
    } catch (err) {
      let msg = err instanceof Error ? err.message : "";
      try { const p = JSON.parse(msg); if (p?.message) msg = p.message; } catch { /* noop */ }
      setDeleteError(msg || t("No se pudo eliminar la cuenta."));
      setDeleting(false);
    }
  };

  const card: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: 12,
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    // 16px mínimo: evita el auto-zoom de iOS dentro del WebView de la app.
    fontSize: 16,
    color: "#0f172a",
    outline: "none",
  };

  return (
    <div className="space-y-4" style={{ maxWidth: 860, animation: "fadeInUp 0.4s ease" }}>

      {/* ── Perfil ── */}
      <div style={{ ...card, borderTop: `2px solid ${TEAL}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div aria-hidden style={{
            width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
            background: "rgba(33,208,179,0.12)", color: TEAL,
            display: "grid", placeItems: "center", fontSize: 22, fontWeight: 800, letterSpacing: "0.04em",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>{name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "3px 10px", borderRadius: 99,
                background: "rgba(33,208,179,0.12)", color: "#0a7a6b", border: "1px solid rgba(33,208,179,0.3)",
              }}>
                {role}
              </span>
              {isUsernameAccount(user?.email) ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                  {t("Cuenta con usuario")}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email || "—"}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginTop: 18 }}>
          {[
            { label: t("Usuario / correo"), value: username || user?.email || "—" },
            { label: t("Rol"), value: role },
            { label: t("Cuenta creada"), value: fmtDate(user?.created_at) },
            { label: t("Último acceso"), value: fmtDate(user?.last_sign_in_at) },
          ].map((row) => (
            <div key={row.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>{row.label}</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis" }}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Módulos habilitados ── */}
      <div style={card}>
        <p style={sectionLabel}>{t("Módulos habilitados")}</p>
        {!grantedByGroup ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            {t("Tu cuenta tiene acceso completo al panel (sin restricción de módulos).")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...grantedByGroup.entries()].map(([group, mods]) => (
              <div key={group}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", margin: "0 0 6px" }}>{group}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {mods.map((m) => (
                    <span key={m.id} style={{
                      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
                      background: "rgba(33,208,179,0.08)", color: "#0a7a6b", border: "1px solid rgba(33,208,179,0.25)",
                    }}>
                      {m.icon} {m.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "4px 0 0" }}>
              {t("Si necesitas acceso a otro módulo, pídelo a un administrador en Gestión de Usuarios.")}
            </p>
          </div>
        )}
      </div>

      {/* ── Seguridad: cambio de contraseña ── */}
      <div style={card}>
        <p style={sectionLabel}>{t("Seguridad")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="password" style={input} placeholder={t("Contraseña actual")} value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          <input type="password" style={input} placeholder={t("Nueva contraseña (mín. 8)")} value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          <input type="password" style={input} placeholder={t("Confirmar nueva contraseña")} value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={handleChangePassword} disabled={pwSaving}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: pwSaving ? "rgba(33,208,179,0.4)" : "linear-gradient(135deg, #21D0B3, #14AE98)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: pwSaving ? "not-allowed" : "pointer",
            }}>
            {pwSaving ? t("Guardando...") : t("Actualizar contraseña")}
          </button>
          {pwMsg && <span style={{ fontSize: 13, color: "#0a7a6b", fontWeight: 600 }}>{pwMsg}</span>}
          {pwError && <span style={{ fontSize: 13, color: "#ef4444" }}>{pwError}</span>}
        </div>
      </div>

      {/* ── Zona de riesgo: solo cuentas NO administradoras ── */}
      {!isAdmin && (
        <div style={{ ...card, border: "1px solid rgba(239,68,68,0.3)" }}>
          <p style={{ ...sectionLabel, color: "#ef4444" }}>{t("Zona de riesgo")}</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
            {t("Eliminar tu cuenta borra tu acceso al panel de forma permanente. Esta acción no se puede deshacer; un administrador tendría que crearte una cuenta nueva.")}
          </p>
          <button type="button" onClick={() => { setDeleteOpen(true); setDeleteText(""); setDeleteError(null); }}
            style={{
              padding: "10px 18px", borderRadius: 10, cursor: "pointer",
              background: "rgba(239,68,68,0.08)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.35)", fontSize: 13, fontWeight: 700,
            }}>
            {t("Eliminar mi cuenta")}
          </button>
        </div>
      )}

      {/* ── Modal de confirmación ── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !deleting && setDeleteOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, borderTop: "3px solid #ef4444", boxShadow: "0 8px 40px rgba(15,23,42,0.25)", padding: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("Eliminar cuenta")}</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "10px 0 0", lineHeight: 1.5 }}>
              {t("Se eliminará permanentemente la cuenta")} <strong>{name}</strong>. {t("Para confirmar, escribe")} <strong>ELIMINAR</strong>:
            </p>
            <input
              style={{ ...input, marginTop: 12 }}
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="ELIMINAR"
              autoFocus
            />
            {deleteError && <p style={{ fontSize: 12.5, color: "#ef4444", margin: "10px 0 0" }}>{deleteError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting}
                style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {t("Cancelar")}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting || deleteText.trim().toUpperCase() !== "ELIMINAR"}
                style={{
                  padding: "9px 16px", borderRadius: 10, border: "none",
                  background: deleteText.trim().toUpperCase() === "ELIMINAR" && !deleting ? "#ef4444" : "rgba(239,68,68,0.35)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: deleteText.trim().toUpperCase() === "ELIMINAR" && !deleting ? "pointer" : "not-allowed",
                }}>
                {deleting ? t("Eliminando...") : t("Eliminar definitivamente")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
