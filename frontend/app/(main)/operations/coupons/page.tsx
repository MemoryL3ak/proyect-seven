"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import Tabs from "@/components/ui/Tabs";
import FilterChips from "@/components/ui/FilterChips";
import EmptyStateBox from "@/components/ui/EmptyState";
import {
  TicketIcon,
  PlusIcon,
  CheckIcon,
  AlertIcon,
  UsersIcon,
  ClipboardIcon,
  SettingsIcon,
} from "@/components/ui/Icons";

type Coupon = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  category: string;
  discountType?: string;
  discountValue?: number | null;
  termsAndConditions?: string | null;
  partnerName?: string | null;
  partnerLogoUrl?: string | null;
  partnerAddress?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  audience?: string[] | null;
  status?: string | null;
  imageUrl?: string | null;
};

type Partner = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  active: boolean;
  allowedCouponIds?: string[] | null;
};

type Claim = {
  id: string;
  couponId: string;
  userId: string;
  userName?: string | null;
  userType?: string | null;
  uniqueCode: string;
  status: "CLAIMED" | "REDEEMED" | "EXPIRED" | "REVOKED";
  claimedAt: string;
  expiresAt: string;
  redeemedAt?: string | null;
  redemptionLocation?: string | null;
};

type Stats = {
  totalCoupons: number;
  activeCoupons: number;
  totalClaims: number;
  activeClaims: number;
  totalRedemptions: number;
  expiredClaims: number;
};

const CATEGORIES = [
  { value: "COMIDA", label: "Comida", color: "#c78c00", bg: "#fff4d6" },
  { value: "ENTRETENIMIENTO", label: "Entretenimiento", color: "#5e3aab", bg: "#f4f0fb" },
  { value: "TIENDA", label: "Tienda", color: "#2e7d32", bg: "#e7f5ec" },
  { value: "OTHER", label: "Otros", color: "#5e6b7a", bg: "#eef1f6" },
];

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "% de descuento" },
  { value: "AMOUNT", label: "Monto fijo ($)" },
  { value: "FREE", label: "Gratis" },
  { value: "TEXT", label: "Descripción libre" },
];

const AUDIENCE_OPTIONS = [
  { value: "ATHLETE", label: "Atletas" },
  { value: "VIP", label: "VIPs" },
  { value: "STAFF", label: "Staff" },
  { value: "DELEGATION_LEAD", label: "Jefes de delegación" },
];

const CLAIM_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  CLAIMED: { label: "Activo", color: "#1f4e8c", bg: "#e3edfa" },
  REDEEMED: { label: "Canjeado", color: "#2e7d32", bg: "#e7f5ec" },
  EXPIRED: { label: "Expirado", color: "#b3231b", bg: "#fde2e2" },
  REVOKED: { label: "Anulado", color: "#5e6b7a", bg: "#eef1f6" },
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const fmtFull = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }) : "-";
const fmtDateTimeLocal = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

const categoryMeta = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat) || CATEGORIES[3];

// Lee una imagen, la redimensiona (máx. 800px) y la comprime a JPEG,
// devolviendo un data URL liviano para guardar en imageUrl.
async function compressImageToDataUrl(file: File, maxDim = 800, quality = 0.8): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// Imagen de la tarjeta con fallback: si la URL no carga, muestra el placeholder
// (ícono de la categoría) en vez del ícono de imagen rota del navegador.
function CouponImage({ src, alt, color, bg }: { src?: string | null; alt: string; color: string; bg: string }) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <div style={{ height: 132, background: showImg ? "#f1f5f9" : `linear-gradient(135deg, ${bg}, #ffffff)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {showImg ? (
        <img src={src as string} alt={alt} onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <TicketIcon size={40} color={color} />
      )}
    </div>
  );
}

function discountDisplay(c: Coupon) {
  switch (c.discountType) {
    case "PERCENTAGE":
      return c.discountValue ? `${c.discountValue}% OFF` : "Descuento %";
    case "AMOUNT":
      return c.discountValue ? `$${Number(c.discountValue).toLocaleString("es-CL")}` : "Descuento $";
    case "FREE": return "GRATIS";
    default: return c.discountValue?.toString() || "Beneficio especial";
  }
}

export default function CouponsAdminPage() {
  const [tab, setTab] = useState<"catalog" | "partners" | "claims">("catalog");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [list, prt, cl, st] = await Promise.all([
        apiFetch<Coupon[]>("/coupons"),
        apiFetch<Partner[]>("/coupon-partners"),
        apiFetch<Claim[]>("/coupons/claims"),
        apiFetch<Stats>("/coupons/stats"),
      ]);
      setCoupons(Array.isArray(list) ? list : []);
      setPartners(Array.isArray(prt) ? prt : []);
      setClaims(Array.isArray(cl) ? cl : []);
      setStats(st || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Beneficios"
        description="Sistema de beneficios con QR para atletas, VIPs y staff. El atleta los reclama desde su portal y los presenta en el comercio."
        icon={<TicketIcon size={24} />}
        iconBg="linear-gradient(135deg, #d4a017 0%, #e3a808 100%)"
      />

      {/* KPIs */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Cupones" value={stats.totalCoupons}
            detail={`${stats.activeCoupons} activos`}
            icon={<TicketIcon size={18} />} accent="blue" />
          <KpiCard label="Reclamados (vigentes)" value={stats.activeClaims}
            icon={<ClipboardIcon size={18} />} accent="amber" />
          <KpiCard label="Canjeados" value={stats.totalRedemptions}
            icon={<CheckIcon size={18} />} accent="green" />
          <KpiCard label="Partners habilitados" value={partners.filter(p => p.active).length}
            detail={`${partners.length} totales`}
            icon={<UsersIcon size={18} />} accent="purple" />
        </section>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: "catalog", label: "Catálogo", icon: <TicketIcon size={16} />, badge: coupons.length },
            { key: "partners", label: "Partners", icon: <UsersIcon size={16} />, badge: partners.length },
            { key: "claims", label: "Claims", icon: <ClipboardIcon size={16} />, badge: claims.filter(c => c.status === "CLAIMED").length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {error && (
        <section className="surface rounded-2xl p-4"
          style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}
      {message && !error && (
        <section className="surface rounded-2xl p-4"
          style={{ borderLeft: "4px solid #2e7d32", backgroundColor: "#e7f5ec" }}>
          <p className="text-sm" style={{ color: "#1e5125" }}>{message}</p>
        </section>
      )}

      {tab === "catalog" && (
        <CatalogTab coupons={coupons} reload={loadAll}
          setError={setError} setMessage={setMessage} />
      )}
      {tab === "partners" && (
        <PartnersTab partners={partners} coupons={coupons} reload={loadAll}
          setError={setError} setMessage={setMessage} />
      )}
      {tab === "claims" && (
        <ClaimsTab claims={claims} coupons={coupons} reload={loadAll}
          setError={setError} setMessage={setMessage} />
      )}
    </div>
  );
}

// ── Tab: Catálogo ────────────────────────────────────────────────────────────

function CatalogTab({
  coupons, reload, setError, setMessage,
}: {
  coupons: Coupon[];
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
  setMessage: (s: string | null) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Coupon>>({});
  const [saving, setSaving] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  const visible = useMemo(() => coupons
    .filter((c) => (categoryFilter ? c.category === categoryFilter : true))
    .filter((c) => (statusFilter ? c.status === statusFilter : true)),
    [coupons, categoryFilter, statusFilter]);

  const openModal = (c?: Coupon) => {
    setForm(c ? { ...c } : {
      category: "COMIDA", discountType: "PERCENTAGE", perUserLimit: 1,
      audience: [], status: "ACTIVE",
    });
    setModalOpen(true);
  };

  const setField = <K extends keyof Coupon>(k: K, v: Coupon[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAudience = (v: string) => {
    const cur = form.audience || [];
    setField("audience", (cur.includes(v) ? cur.filter(a => a !== v) : [...cur, v]) as any);
  };

  const save = async () => {
    if (!form.code || !form.title) {
      setError("Código y título son obligatorios");
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload = { ...form };
      const id = (form as any).id;
      delete (payload as any).id;
      await apiFetch(id ? `/coupons/${id}` : "/coupons", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(id ? "Cupón actualizado." : "Cupón creado.");
      setModalOpen(false); setForm({});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este cupón? Esta acción no se puede deshacer.")) return;
    try {
      await apiFetch(`/coupons/${id}`, { method: "DELETE" });
      setMessage("Cupón eliminado.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando");
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn btn-primary" type="button" onClick={() => openModal()}>
          <PlusIcon size={16} className="inline-block mr-1" />
          Nuevo cupón
        </button>
      </div>

      <section className="surface rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}>Categoría</p>
          <FilterChips value={categoryFilter} onChange={setCategoryFilter}
            options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
            allLabel="Todas" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}>Estado</p>
          <FilterChips value={statusFilter} onChange={setStatusFilter}
            options={[
              { value: "ACTIVE", label: "Activos" },
              { value: "INACTIVE", label: "Inactivos" },
              { value: "EXPIRED", label: "Expirados" },
            ]}
            allLabel="Todos" />
        </div>
      </section>

      {visible.length === 0 ? (
        <EmptyStateBox
          icon={<TicketIcon size={36} />}
          title="No hay cupones cargados"
          description="Crea el primer cupón para que aparezca en la app de tus atletas, VIPs y staff."
          action={
            <button className="btn btn-primary" type="button" onClick={() => openModal()}>
              <PlusIcon size={16} className="inline-block mr-1" />
              Nuevo cupón
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((c) => {
            const cat = categoryMeta(c.category);
            const isActive = c.status === "ACTIVE";
            const expired = c.validUntil && new Date(c.validUntil).getTime() < Date.now();
            return (
              <article key={c.id} className="surface rounded-2xl overflow-hidden"
                style={{ borderTop: `5px solid ${cat.color}`, opacity: isActive && !expired ? 1 : 0.6 }}>
                <CouponImage src={c.imageUrl} alt={c.title} color={cat.color} bg={cat.bg} />
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cat.bg, color: cat.color }}>
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-medium"
                      style={{ backgroundColor: "#eef1f6", color: "#1f4e8c" }}>
                      {c.code}
                    </span>
                  </div>
                  <p className="font-semibold text-base leading-tight">{c.title}</p>
                  {c.partnerName && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.partnerName}</p>
                  )}
                  <p className="text-2xl font-bold" style={{ color: cat.color }}>
                    {discountDisplay(c)}
                  </p>
                  {c.description && (
                    <p className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {c.description}
                    </p>
                  )}
                  {(c.validUntil || c.maxRedemptions) && (
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {c.validUntil && <>Hasta {fmtDate(c.validUntil)}</>}
                      {c.maxRedemptions && <> · Máx. {c.maxRedemptions} canjes</>}
                    </p>
                  )}
                  {expired && (
                    <p className="text-[11px] font-medium" style={{ color: "#b3231b" }}>
                      ⚠ Expirado
                    </p>
                  )}
                </div>
                <div className="border-t px-4 py-2 flex gap-1 justify-end"
                  style={{ backgroundColor: "#fafbfc" }}>
                  <button className="btn btn-ghost text-xs py-1 px-2" type="button"
                    onClick={() => openModal(c)}>Editar</button>
                  <button className="btn btn-ghost text-xs py-1 px-2" type="button"
                    onClick={() => remove(c.id)}>Eliminar</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold">
                {(form as any).id ? "Editar cupón" : "Nuevo cupón"}
              </h2>
              <button className="btn btn-ghost text-sm" type="button" onClick={() => setModalOpen(false)}>
                Cerrar ✕
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Código *">
                <input type="text" className="input font-mono uppercase"
                  placeholder="MCDO20" value={form.code || ""}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Categoría *">
                <select className="input" value={form.category || "COMIDA"}
                  onChange={(e) => setField("category", e.target.value as any)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Título *" className="md:col-span-2">
                <input type="text" className="input" placeholder="20% OFF en McDonald's"
                  value={form.title || ""} onChange={(e) => setField("title", e.target.value)} />
              </Field>
              <Field label="Descripción" className="md:col-span-2">
                <textarea rows={2} className="input" value={form.description || ""}
                  onChange={(e) => setField("description", e.target.value)} />
              </Field>
              <Field label="Tipo de descuento">
                <select className="input" value={form.discountType || "PERCENTAGE"}
                  onChange={(e) => setField("discountType", e.target.value as any)}>
                  {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>
              <Field label={form.discountType === "AMOUNT" ? "Monto ($)" : "Valor"}>
                <input type="number" min={0} className="input" value={form.discountValue ?? ""}
                  onChange={(e) => setField("discountValue", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Comercio / Partner">
                <input type="text" className="input" placeholder="McDonald's"
                  value={form.partnerName || ""} onChange={(e) => setField("partnerName", e.target.value)} />
              </Field>
              <Field label="Dirección del local">
                <input type="text" className="input" value={form.partnerAddress || ""}
                  onChange={(e) => setField("partnerAddress", e.target.value)} />
              </Field>
              <Field label="Imagen referencial" className="md:col-span-2">
                <div className="flex items-start gap-3">
                  <div style={{ width: 104, height: 78, borderRadius: 10, overflow: "hidden", background: "#f1f5f9", border: "1px solid #e2e8f0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="Vista previa"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>Sin imagen</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <input type="file" accept="image/*" className="text-xs block"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImgLoading(true);
                        try {
                          setField("imageUrl", await compressImageToDataUrl(file) as any);
                        } catch {
                          setError("No se pudo procesar la imagen.");
                        } finally {
                          setImgLoading(false);
                          e.target.value = "";
                        }
                      }} />
                    <input type="text" className="input"
                      placeholder="…o pega una URL de imagen"
                      value={form.imageUrl && !form.imageUrl.startsWith("data:") ? form.imageUrl : ""}
                      onChange={(e) => setField("imageUrl", (e.target.value || null) as any)} />
                    <div className="flex items-center gap-2">
                      {imgLoading && (
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Procesando imagen…</span>
                      )}
                      {form.imageUrl && !imgLoading && (
                        <button type="button" className="btn btn-ghost text-xs py-1 px-2"
                          onClick={() => setField("imageUrl", null as any)}>Quitar imagen</button>
                      )}
                    </div>
                  </div>
                </div>
              </Field>
              <Field label="Válido desde">
                <input type="datetime-local" className="input"
                  value={fmtDateTimeLocal(form.validFrom)}
                  onChange={(e) => setField("validFrom",
                    e.target.value ? new Date(e.target.value).toISOString() : null as any)} />
              </Field>
              <Field label="Válido hasta">
                <input type="datetime-local" className="input"
                  value={fmtDateTimeLocal(form.validUntil)}
                  onChange={(e) => setField("validUntil",
                    e.target.value ? new Date(e.target.value).toISOString() : null as any)} />
              </Field>
              <Field label="Máx. canjes (total)">
                <input type="number" min={1} className="input" placeholder="Sin límite"
                  value={form.maxRedemptions ?? ""}
                  onChange={(e) => setField("maxRedemptions",
                    e.target.value ? Number(e.target.value) : null as any)} />
              </Field>
              <Field label="Máx. canjes por usuario">
                <input type="number" min={1} className="input" value={form.perUserLimit ?? 1}
                  onChange={(e) => setField("perUserLimit", Number(e.target.value) || 1)} />
              </Field>
              <Field label="Audiencia" className="md:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((a) => {
                    const sel = (form.audience || []).includes(a.value);
                    return (
                      <button key={a.value} type="button"
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition"
                        style={{
                          backgroundColor: sel ? "#1f4e8c" : "#eef1f6",
                          color: sel ? "#fff" : "#1f4e8c",
                        }}
                        onClick={() => toggleAudience(a.value)}>
                        {sel ? "✓ " : ""}{a.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Si no seleccionas ninguno, el cupón es visible para todos.
                </p>
              </Field>
              <Field label="Términos y condiciones" className="md:col-span-2">
                <textarea rows={3} className="input"
                  placeholder="Letra chica, no acumulable, etc."
                  value={form.termsAndConditions || ""}
                  onChange={(e) => setField("termsAndConditions", e.target.value)} />
              </Field>
              <Field label="Estado">
                <select className="input" value={form.status || "ACTIVE"}
                  onChange={(e) => setField("status", e.target.value)}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="EXPIRED">Expirado</option>
                </select>
              </Field>
            </div>
            <div className="p-5 border-t flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
              <button className="btn btn-ghost" type="button" onClick={() => setModalOpen(false)}
                disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab: Partners ────────────────────────────────────────────────────────────

function PartnersTab({
  partners, coupons, reload, setError, setMessage,
}: {
  partners: Partner[];
  coupons: Coupon[];
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
  setMessage: (s: string | null) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Partner> & { pin?: string }>({});
  const [saving, setSaving] = useState(false);

  const openModal = (p?: Partner) => {
    setForm(p ? { ...p, pin: "" } : { active: true, allowedCouponIds: [] });
    setModalOpen(true);
  };

  const setField = (k: keyof typeof form, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAllowed = (couponId: string) => {
    const cur = form.allowedCouponIds || [];
    setField("allowedCouponIds",
      cur.includes(couponId) ? cur.filter(id => id !== couponId) : [...cur, couponId]);
  };

  const save = async () => {
    if (!form.code || !form.name) {
      setError("Código y nombre son obligatorios");
      return;
    }
    const id = (form as any).id;
    if (!id && (!form.pin || form.pin.length < 4)) {
      setError("PIN inicial debe tener al menos 4 caracteres");
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload: any = { ...form };
      delete payload.id;
      if (!payload.pin) delete payload.pin;
      await apiFetch(id ? `/coupon-partners/${id}` : "/coupon-partners", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(id ? "Partner actualizado." : "Partner creado.");
      setModalOpen(false); setForm({});
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando partner");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este partner? Pierde acceso al sistema.")) return;
    try {
      await apiFetch(`/coupon-partners/${id}`, { method: "DELETE" });
      setMessage("Partner eliminado.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Comercios con acceso al scanner. Cada partner usa su <strong>código + PIN</strong> para entrar en
          <a href="/portal/partner" className="ml-1 underline" style={{ color: "#1f4e8c" }}>
            /portal/partner
          </a>.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => openModal()}>
          <PlusIcon size={16} className="inline-block mr-1" />
          Nuevo partner
        </button>
      </div>

      {partners.length === 0 ? (
        <EmptyStateBox
          icon={<UsersIcon size={36} />}
          title="No hay partners cargados"
          description="Crea el primer comercio para habilitarle el acceso al scanner de QR."
          action={
            <button className="btn btn-primary" type="button" onClick={() => openModal()}>
              <PlusIcon size={16} className="inline-block mr-1" />
              Nuevo partner
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {partners.map((p) => (
            <article key={p.id} className="surface rounded-2xl p-4"
              style={{ borderLeft: `4px solid ${p.active ? "#2e7d32" : "#5e6b7a"}`, opacity: p.active ? 1 : 0.6 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded font-medium"
                      style={{ backgroundColor: "#eef1f6", color: "#1f4e8c" }}>
                      {p.code}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: p.active ? "#e7f5ec" : "#eef1f6",
                        color: p.active ? "#2e7d32" : "#5e6b7a",
                      }}>
                      {p.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <h3 className="font-semibold mt-1">{p.name}</h3>
                  {p.address && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {p.address}
                    </p>
                  )}
                  {p.contactName && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {p.contactName}{p.contactPhone ? ` · ${p.contactPhone}` : ""}
                    </p>
                  )}
                  <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                    {(p.allowedCouponIds?.length ?? 0) > 0
                      ? `Canjea ${p.allowedCouponIds!.length} cupones específicos`
                      : "Puede canjear todos los cupones"}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button className="btn btn-ghost text-xs py-1 px-2" type="button"
                    onClick={() => openModal(p)}>Editar</button>
                  <button className="btn btn-ghost text-xs py-1 px-2" type="button"
                    onClick={() => remove(p.id)}>Eliminar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal partner */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold">
                {(form as any).id ? "Editar partner" : "Nuevo partner"}
              </h2>
              <button className="btn btn-ghost text-sm" type="button"
                onClick={() => setModalOpen(false)}>Cerrar ✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Código del local *">
                <input type="text" className="input font-mono uppercase"
                  placeholder="MCDO-001" value={form.code || ""}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())} />
              </Field>
              <Field label={(form as any).id ? "PIN (dejar vacío para no cambiar)" : "PIN inicial *"}>
                <input type="text" className="input font-mono text-center tracking-widest"
                  placeholder="••••" value={form.pin || ""}
                  onChange={(e) => setField("pin", e.target.value)}
                  maxLength={12} />
              </Field>
              <Field label="Nombre del comercio *" className="md:col-span-2">
                <input type="text" className="input" placeholder="McDonald's Las Condes"
                  value={form.name || ""} onChange={(e) => setField("name", e.target.value)} />
              </Field>
              <Field label="Dirección" className="md:col-span-2">
                <input type="text" className="input" value={form.address || ""}
                  onChange={(e) => setField("address", e.target.value)} />
              </Field>
              <Field label="Contacto">
                <input type="text" className="input" value={form.contactName || ""}
                  onChange={(e) => setField("contactName", e.target.value)} />
              </Field>
              <Field label="Teléfono">
                <input type="text" className="input" value={form.contactPhone || ""}
                  onChange={(e) => setField("contactPhone", e.target.value)} />
              </Field>
              <Field label="Cupones que puede canjear" className="md:col-span-2">
                <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                  Si no seleccionás ninguno, puede canjear todos los cupones del sistema.
                </p>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-1 rounded-lg"
                  style={{ backgroundColor: "#fafbfc" }}>
                  {coupons.map((c) => {
                    const sel = (form.allowedCouponIds || []).includes(c.id);
                    return (
                      <button key={c.id} type="button"
                        className="text-[11px] px-2 py-1 rounded-full font-medium transition"
                        style={{
                          backgroundColor: sel ? "#1f4e8c" : "#fff",
                          color: sel ? "#fff" : "#1f4e8c",
                          border: sel ? "none" : "1px solid #d4dae2",
                        }}
                        onClick={() => toggleAllowed(c.id)}>
                        {sel ? "✓ " : ""}{c.code} · {c.title.slice(0, 24)}{c.title.length > 24 ? "…" : ""}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Activo">
                <select className="input"
                  value={form.active ? "true" : "false"}
                  onChange={(e) => setField("active", e.target.value === "true")}>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </Field>
            </div>
            <div className="p-5 border-t flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
              <button className="btn btn-ghost" type="button" onClick={() => setModalOpen(false)}
                disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab: Claims ──────────────────────────────────────────────────────────────

function ClaimsTab({
  claims, coupons, reload, setError, setMessage,
}: {
  claims: Claim[];
  coupons: Coupon[];
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
  setMessage: (s: string | null) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [couponFilter, setCouponFilter] = useState("");

  const visible = useMemo(() => claims
    .filter((c) => statusFilter ? c.status === statusFilter : true)
    .filter((c) => couponFilter ? c.couponId === couponFilter : true),
    [claims, statusFilter, couponFilter]);

  const couponLabel = (id: string) => {
    const c = coupons.find((x) => x.id === id);
    return c ? `${c.code} · ${c.title}` : "—";
  };

  const revoke = async (claimId: string) => {
    if (!confirm("¿Anular este claim? El atleta no podrá canjearlo y vuelve a contar el límite.")) return;
    try {
      await apiFetch(`/coupons/claims/${claimId}/revoke`, { method: "POST" });
      setMessage("Claim anulado.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error anulando claim");
    }
  };

  return (
    <>
      <section className="surface rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}>Estado</p>
          <FilterChips value={statusFilter} onChange={setStatusFilter}
            options={[
              { value: "CLAIMED", label: "Activos", count: claims.filter(c => c.status === "CLAIMED").length },
              { value: "REDEEMED", label: "Canjeados", count: claims.filter(c => c.status === "REDEEMED").length },
              { value: "EXPIRED", label: "Expirados", count: claims.filter(c => c.status === "EXPIRED").length },
              { value: "REVOKED", label: "Anulados", count: claims.filter(c => c.status === "REVOKED").length },
            ]}
            allLabel="Todos" />
        </div>
        {coupons.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: "var(--text-muted)" }}>Cupón</p>
            <select className="input max-w-md"
              value={couponFilter} onChange={(e) => setCouponFilter(e.target.value)}>
              <option value="">Todos los cupones</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {visible.length === 0 ? (
        <EmptyStateBox
          icon={<ClipboardIcon size={36} />}
          title="No hay claims"
          description="Cuando los atletas reclamen cupones desde su portal, aparecerán acá."
        />
      ) : (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ backgroundColor: "#1f4e8c", color: "#fff" }}>
                <tr>
                  <th className="p-3 text-left">Código</th>
                  <th className="p-3 text-left">Cupón</th>
                  <th className="p-3 text-left">Usuario</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Reclamado</th>
                  <th className="p-3 text-left">Canjeado</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => {
                  const meta = CLAIM_STATUS_META[c.status];
                  return (
                    <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-3 font-mono font-medium">{c.uniqueCode}</td>
                      <td className="p-3">{couponLabel(c.couponId)}</td>
                      <td className="p-3">
                        {c.userName || c.userId}
                        {c.userType && (
                          <span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {c.userType}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3">{fmtFull(c.claimedAt)}</td>
                      <td className="p-3">
                        {c.redeemedAt
                          ? <>{fmtFull(c.redeemedAt)}{c.redemptionLocation && (
                              <span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {c.redemptionLocation}
                              </span>)}</>
                          : "—"}
                      </td>
                      <td className="p-3">
                        {c.status === "CLAIMED" && (
                          <button type="button" className="text-[11px] underline"
                            style={{ color: "#b3231b" }}
                            onClick={() => revoke(c.id)}>
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`text-sm block ${className || ""}`}>
      <span className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
