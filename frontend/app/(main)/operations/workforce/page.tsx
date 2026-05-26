"use client";

import { useEffect, useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import Tabs from "@/components/ui/Tabs";
import EmptyStateBox from "@/components/ui/EmptyState";
import {
  UsersIcon,
  PackageIcon,
  ClipboardIcon,
  DollarIcon,
  PlusIcon,
  AlertIcon,
  CheckIcon,
} from "@/components/ui/Icons";

type Person = {
  id: string;
  fullName: string;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  personType: "STAFF" | "VOLUNTEER" | string;
  role?: string | null;
  dailyRate?: number | null;
  daysCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  notes?: string | null;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  unitCost?: number | null;
  barcode?: string | null;
  hasSizes?: boolean;
  availableSizes?: string[];
  stockQuantity?: number | null;
  category?: string | null;
  status?: string | null;
};

type Delivery = {
  id: string;
  personId: string;
  productId: string;
  quantity: number;
  size?: string | null;
  unitCost?: number | null;
  deliveredAt?: string | null;
  deliveredBy?: string | null;
  validatedAt?: string | null;
  validatedBy?: string | null;
  notes?: string | null;
};

type Dashboard = {
  persons: { total: number; staff: number; volunteers: number };
  products: { total: number; totalInventoryValue: number };
  deliveries: { total: number; validated: number; pending: number; totalDeliveredValue: number };
  costs: { labor: number; materials: number; total: number };
};

const PERSON_TYPES = [
  { value: "STAFF", label: "Staff" },
  { value: "VOLUNTEER", label: "Voluntario" },
];

const GENDER_OPTIONS = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Femenino" },
  { value: "MIXED", label: "Otro / Prefiero no decir" },
];

const PRODUCT_CATEGORIES = [
  { value: "CLOTHING", label: "Vestimenta" },
  { value: "ACCESSORY", label: "Accesorio" },
  { value: "EQUIPMENT", label: "Equipo" },
];

const fmt$ = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n || 0));

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export default function WorkforcePage() {
  const [tab, setTab] = useState<"dashboard" | "persons" | "products" | "deliveries">("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [persons, setPersons] = useState<Person[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  // Modal estado: tipo + entidad en edición
  const [modal, setModal] = useState<
    | { type: "person"; data: Partial<Person> | null }
    | { type: "product"; data: Partial<Product> | null }
    | { type: "delivery"; data: Partial<Delivery> | null }
    | null
  >(null);
  const [saving, setSaving] = useState(false);

  const personById = useMemo(() => {
    const m = new Map<string, Person>();
    persons.forEach((p) => m.set(p.id, p));
    return m;
  }, [persons]);

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const loadAll = async () => {
    try {
      const [p, pr, d, dash] = await Promise.all([
        apiFetch<Person[]>("/workforce/persons"),
        apiFetch<Product[]>("/workforce/products"),
        apiFetch<Delivery[]>("/workforce/deliveries"),
        apiFetch<Dashboard>("/workforce/dashboard"),
      ]);
      setPersons(Array.isArray(p) ? p : []);
      setProducts(Array.isArray(pr) ? pr : []);
      setDeliveries(Array.isArray(d) ? d : []);
      setDashboard(dash || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ── Helpers genéricos para CRUD ────────────────────────────────────────────

  const saveEntity = async () => {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const { type, data } = modal;
      const id = (data as any)?.id;
      const url = id
        ? `/workforce/${type}s/${id}`
        : `/workforce/${type}s`;
      const method = id ? "PATCH" : "POST";
      const payload = { ...(data || {}) };
      delete (payload as any).id;
      await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(id ? "Actualizado correctamente." : "Creado correctamente.");
      setModal(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntity = async (type: "person" | "product" | "delivery", id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      await apiFetch(`/workforce/${type}s/${id}`, { method: "DELETE" });
      setMessage("Eliminado correctamente.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando");
    }
  };

  const validateDelivery = async (id: string) => {
    try {
      await apiFetch(`/workforce/deliveries/${id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validatedBy: "Admin" }),
      });
      setMessage("Entrega validada.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error validando");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Workforce — Staff & Voluntarios"
        description="Gestión del personal contratado, voluntariado, catálogo de productos del kit y entregas operativas."
        icon={<UsersIcon size={24} />}
      />

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as any)}
        tabs={[
          { key: "dashboard", label: "Dashboard", badge: dashboard?.deliveries.pending || undefined },
          { key: "persons", label: "Personas", badge: persons.length || undefined },
          { key: "products", label: "Productos", badge: products.length || undefined },
          { key: "deliveries", label: "Entregas", badge: deliveries.length || undefined },
        ]}
      />

      {error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
        </section>
      )}
      {message && !error && (
        <section className="surface rounded-2xl p-4" style={{ borderLeft: "4px solid #2e7d32", backgroundColor: "#e7f5ec" }}>
          <p className="text-sm" style={{ color: "#1e5125" }}>{message}</p>
        </section>
      )}

      {/* ───────── Dashboard ───────── */}
      {tab === "dashboard" && dashboard && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Total personas"
              value={dashboard.persons.total}
              detail={`${dashboard.persons.staff} staff · ${dashboard.persons.volunteers} voluntarios`}
              icon={<UsersIcon size={18} />}
              accent="blue"
            />
            <KpiCard
              label="Productos catálogo"
              value={dashboard.products.total}
              detail={`${fmt$(dashboard.products.totalInventoryValue)} en inventario`}
              icon={<PackageIcon size={18} />}
              accent="purple"
            />
            <KpiCard
              label="Entregas"
              value={dashboard.deliveries.total}
              detail={`${dashboard.deliveries.validated} validadas · ${dashboard.deliveries.pending} pendientes`}
              icon={<ClipboardIcon size={18} />}
              accent="amber"
            />
            <KpiCard
              label="Costo total"
              value={fmt$(dashboard.costs.total)}
              detail={`${fmt$(dashboard.costs.labor)} mano obra + ${fmt$(dashboard.costs.materials)} materiales`}
              icon={<DollarIcon size={18} />}
              accent="green"
            />
          </section>
          {dashboard.deliveries.pending > 0 && (
            <section
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                borderLeft: "4px solid #c78c00",
                background: "linear-gradient(135deg, #fff8e6 0%, #fff4d6 100%)",
              }}
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(199, 140, 0, 0.18)", color: "#c78c00" }}
              >
                <AlertIcon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#7a4a00" }}>
                  {dashboard.deliveries.pending} entrega(s) pendientes de validación
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#7a4a00" }}>
                  Andá a la pestaña <strong>Entregas</strong> para revisarlas.
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {/* ───────── Personas ───────── */}
      {tab === "persons" && (
        <section className="surface-premium p-5 space-y-4 anim-fade-up-soft relative overflow-hidden">
          <div className="ambient-orb" style={{ width: 220, height: 220, top: -70, right: -50, background: "radial-gradient(circle, rgba(94,58,171,0.10) 0%, transparent 65%)" }} />
          <SectionHeader
            accentColor="#5e3aab"
            icon={<UsersIcon size={20} />}
            label="Personas registradas"
            sub={persons.length > 0
              ? `${persons.length} ${persons.length === 1 ? "persona" : "personas"} · ${persons.filter(p => p.personType === "STAFF").length} staff · ${persons.filter(p => p.personType === "VOLUNTEER").length} voluntarios`
              : "Cargá la primera persona del equipo"}
            action={
              <button className="btn btn-primary" type="button" onClick={() => setModal({ type: "person", data: {} })}>
                <PlusIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
                Nueva persona
              </button>
            }
          />
          {persons.length === 0 ? (
            <EmptyStateBox
              icon={<UsersIcon size={36} />}
              title="Sin personas registradas"
              description="Comenzá agregando staff o voluntarios al evento. Cada persona puede recibir productos del kit y registrar entregas validadas."
              variant="purple"
              action={
                <button className="btn btn-primary" type="button"
                  onClick={() => setModal({ type: "person", data: {} })}>
                  <PlusIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
                  Nueva persona
                </button>
              }
            />
          ) : (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid #e2e8f0", position: "relative" }}>
              <table className="w-full text-xs">
                <thead style={{ background: "linear-gradient(135deg, #1f4e8c 0%, #2d6aa8 100%)", color: "#fff" }}>
                  <tr>
                    <th className="p-3 text-left font-semibold tracking-wide">Nombre</th>
                    <th className="p-3 text-left font-semibold tracking-wide">RUT</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Tipo</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Rol</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Contacto</th>
                    <th className="p-3 text-right font-semibold tracking-wide">$/día</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Días</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Total</th>
                    <th className="p-3 text-center font-semibold tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {persons.map((p, i) => {
                    const total = Number(p.dailyRate || 0) * Number(p.daysCount || 0);
                    const isVolunteer = p.personType === "VOLUNTEER";
                    const maxDays = Math.max(1, ...persons.map((x) => x.daysCount || 0));
                    return (
                      <tr key={p.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                        style={{ transition: "background-color 120ms" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f5f3fb"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PersonAvatar name={p.fullName} type={p.personType} />
                            <div className="min-w-0">
                              <p className="font-semibold leading-tight truncate" style={{ color: "#0f172a" }}>{p.fullName}</p>
                              {p.gender && (
                                <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                  {p.gender === "MALE" ? "Masculino" : p.gender === "FEMALE" ? "Femenino" : p.gender}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {p.rut ? (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded font-semibold"
                              style={{ background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0" }}>
                              {p.rut}
                            </span>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td className="p-3"><PersonTypeBadge type={p.personType} /></td>
                        <td className="p-3" style={{ color: "#334155" }}>
                          {p.role ? (
                            <span className="inline-flex items-center gap-1.5 text-[11.5px]">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#94a3b8", flexShrink: 0 }}>
                                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                              </svg>
                              {p.role}
                            </span>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td className="p-3"><ContactCell email={p.email} phone={p.phone} /></td>
                        <td className="p-3 text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="font-semibold tabular-nums" style={{ color: isVolunteer ? "#94a3b8" : "#0f172a" }}>
                              {fmt$(p.dailyRate)}
                            </span>
                            {!isVolunteer && <span className="text-[9.5px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>diario</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className="font-semibold tabular-nums" style={{ color: "#334155" }}>{p.daysCount || 0}</span>
                            <MiniBar value={p.daysCount || 0} max={maxDays} color={isVolunteer ? "#5e3aab" : "#1f4e8c"} />
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold tabular-nums text-[13px]" style={{ color: isVolunteer ? "#94a3b8" : "#0f172a" }}>{fmt$(total)}</span>
                        </td>
                        <td className="p-3">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <IconActionButton variant="edit" title="Editar persona"
                              onClick={() => setModal({ type: "person", data: p })} />
                            <IconActionButton variant="delete" title="Eliminar persona"
                              onClick={() => deleteEntity("person", p.id)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #cbd5e1", background: "#f8fafc" }}>
                    <td colSpan={7} className="p-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Total nómina mano de obra
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold tabular-nums text-sm" style={{ color: "#5e3aab" }}>
                        {fmt$(persons.reduce((s, p) => s + Number(p.dailyRate || 0) * Number(p.daysCount || 0), 0))}
                      </span>
                    </td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ───────── Productos ───────── */}
      {tab === "products" && (
        <section className="surface-premium p-5 space-y-4 anim-fade-up-soft relative overflow-hidden">
          <div className="ambient-orb" style={{ width: 220, height: 220, top: -70, right: -50, background: "radial-gradient(circle, rgba(199,140,0,0.10) 0%, transparent 65%)" }} />
          <SectionHeader
            accentColor="#c78c00"
            icon={<PackageIcon size={20} />}
            label="Catálogo de productos"
            sub={products.length > 0
              ? `${products.length} ${products.length === 1 ? "producto" : "productos"} · stock total ${products.reduce((s, p) => s + (p.stockQuantity || 0), 0)} unidades · ${products.filter(p => !!p.barcode).length} con código`
              : "Definí qué se entrega en el kit"}
            action={
              <div className="inline-flex items-center gap-2 flex-wrap">
                {products.some((p) => !!p.barcode) && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => printBarcodeLabels(
                      products.filter((p) => !!p.barcode).map((p) => ({
                        name: p.name, barcode: p.barcode!,
                        category: PRODUCT_CATEGORIES.find((c) => c.value === p.category)?.label || p.category,
                      }))
                    )}
                    title="Imprime una hoja con los códigos de barra de todos los productos"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1.5 -mt-0.5">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Imprimir códigos
                  </button>
                )}
                <button className="btn btn-primary" type="button" onClick={() => setModal({ type: "product", data: {} })}>
                  <PlusIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
                  Nuevo producto
                </button>
              </div>
            }
          />
          {products.length === 0 ? (
            <EmptyStateBox
              icon={<PackageIcon size={36} />}
              title="Sin productos en el catálogo"
              description="Cargá los productos del kit que se entregan al staff (polera, polerón, pantalón, etc.). Cada uno con su costo, tallas y código de barras."
              variant="warning"
              action={
                <button className="btn btn-primary" type="button"
                  onClick={() => setModal({ type: "product", data: {} })}>
                  <PlusIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
                  Nuevo producto
                </button>
              }
            />
          ) : (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
              <table className="w-full text-xs">
                <thead style={{ background: "linear-gradient(135deg, #1f4e8c 0%, #2d6aa8 100%)", color: "#fff" }}>
                  <tr>
                    <th className="p-3 text-left font-semibold tracking-wide">Producto</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Categoría</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Código barras</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Tallas</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Stock</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Costo unit.</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Valor inventario</th>
                    <th className="p-3 text-center font-semibold tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const stock = p.stockQuantity || 0;
                    const inventory = Number(p.unitCost || 0) * stock;
                    const lowStock = stock > 0 && stock < 20;
                    const noStock = stock === 0;
                    const maxStock = Math.max(1, ...products.map((x) => x.stockQuantity || 0));
                    return (
                      <tr key={p.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                        style={{ transition: "background-color 120ms" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fffaf0"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="flex-shrink-0 inline-flex items-center justify-center rounded-xl"
                              style={{
                                width: 34, height: 34,
                                background: "linear-gradient(135deg, #fff4d6 0%, #fce6a8 100%)",
                                color: "#c78c00",
                                border: "1px solid #c78c0033",
                                boxShadow: "0 2px 6px rgba(199,140,0,0.18)",
                              }}
                            >
                              <PackageIcon size={17} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold leading-tight" style={{ color: "#0f172a" }}>{p.name}</p>
                              {p.description && (
                                <p className="text-[10.5px] mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{p.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3"><CategoryChip value={p.category} /></td>
                        <td className="p-3">
                          {p.barcode ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 1, height: 22, padding: "0 4px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4 }}>
                                {p.barcode.split("").slice(0, 10).map((ch, j) => (
                                  <span key={j} style={{
                                    display: "inline-block",
                                    width: `${(ch.charCodeAt(0) % 3) + 1}px`,
                                    height: "100%",
                                    background: "#0f172a",
                                  }} />
                                ))}
                              </span>
                              <span className="text-[10.5px] tracking-wider font-mono" style={{ color: "#475569" }}>{p.barcode}</span>
                            </span>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td className="p-3">
                          {p.hasSizes && p.availableSizes && p.availableSizes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.availableSizes.map((s) => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                                  style={{ background: "#eef4fb", color: "#1f4e8c", border: "1px solid #c7d8ed", minWidth: 22, textAlign: "center" }}>{s}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: "#f1f5f9", color: "#94a3b8" }}>Talla única</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1.5 font-bold tabular-nums"
                              style={{ color: noStock ? "#b3231b" : lowStock ? "#c78c00" : "#0f172a" }}>
                              {(noStock || lowStock) && (
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: noStock ? "#b3231b" : "#c78c00", animation: "pulse 1.8s infinite" }} />
                              )}
                              {stock}
                            </span>
                            <MiniBar value={stock} max={maxStock} color={noStock ? "#b3231b" : lowStock ? "#c78c00" : "#1eb19a"} />
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="font-semibold tabular-nums" style={{ color: "#334155" }}>{fmt$(p.unitCost)}</span>
                            <span className="text-[9.5px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>por unidad</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold tabular-nums text-[13px]" style={{ color: "#0f172a" }}>{fmt$(inventory)}</span>
                        </td>
                        <td className="p-3">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <IconActionButton
                              variant="print"
                              title={p.barcode ? "Imprimir código de barras" : "Este producto no tiene código de barras asignado"}
                              disabled={!p.barcode}
                              onClick={() => p.barcode && printBarcodeLabels([{
                                name: p.name, barcode: p.barcode,
                                category: PRODUCT_CATEGORIES.find((c) => c.value === p.category)?.label || p.category,
                              }])}
                            />
                            <IconActionButton variant="edit" title="Editar producto"
                              onClick={() => setModal({ type: "product", data: p })} />
                            <IconActionButton variant="delete" title="Eliminar producto"
                              onClick={() => deleteEntity("product", p.id)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #cbd5e1", background: "#f8fafc" }}>
                    <td colSpan={6} className="p-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Valor total de inventario
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold tabular-nums text-sm" style={{ color: "#c78c00" }}>
                        {fmt$(products.reduce((s, p) => s + Number(p.unitCost || 0) * (p.stockQuantity || 0), 0))}
                      </span>
                    </td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ───────── Entregas ───────── */}
      {tab === "deliveries" && (
        <section className="surface-premium p-5 space-y-4 anim-fade-up-soft relative overflow-hidden">
          <div className="ambient-orb" style={{ width: 220, height: 220, top: -70, right: -50, background: "radial-gradient(circle, rgba(33,208,179,0.10) 0%, transparent 65%)" }} />
          <SectionHeader
            accentColor="#1eb19a"
            icon={<ClipboardIcon size={20} />}
            label="Registro de entregas"
            sub={deliveries.length > 0
              ? `${deliveries.length} entregas · ${deliveries.filter((d) => d.validatedAt).length} validadas · ${deliveries.filter((d) => !d.validatedAt).length} pendientes`
              : "Registrá cuando una persona recibe productos del kit"}
            action={
              <button className="btn btn-primary" type="button"
                onClick={() => setModal({ type: "delivery", data: { quantity: 1 } })}>
                <PlusIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
                Nueva entrega
              </button>
            }
          />
          {deliveries.length === 0 ? (
            <EmptyStateBox
              icon={<ClipboardIcon size={36} />}
              title="Sin entregas registradas"
              description="Las entregas se registran cuando una persona recibe un producto del kit. Cada entrega luego se valida por un supervisor."
              variant="default"
              action={
                <button className="btn btn-primary" type="button"
                  onClick={() => setModal({ type: "delivery", data: { quantity: 1 } })}>
                  <PlusIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
                  Nueva entrega
                </button>
              }
            />
          ) : (
            <div className="overflow-auto rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
              <table className="w-full text-xs">
                <thead style={{ background: "linear-gradient(135deg, #1f4e8c 0%, #2d6aa8 100%)", color: "#fff" }}>
                  <tr>
                    <th className="p-3 text-left font-semibold tracking-wide">Fecha</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Persona</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Producto</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Talla</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Cant.</th>
                    <th className="p-3 text-right font-semibold tracking-wide">Costo</th>
                    <th className="p-3 text-left font-semibold tracking-wide">Estado</th>
                    <th className="p-3 text-center font-semibold tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d, i) => {
                    const per = personById.get(d.personId);
                    const prod = productById.get(d.productId);
                    const cost = Number(d.unitCost || 0) * Number(d.quantity || 0);
                    const pending = !d.validatedAt;
                    return (
                      <tr key={d.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                        style={{ transition: "background-color 120ms" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f0fdfb"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                      >
                        <td className="p-3 whitespace-nowrap">
                          <div className="inline-flex flex-col">
                            <span className="font-semibold" style={{ color: "#0f172a" }}>{fmtDate(d.deliveredAt)}</span>
                            {d.deliveredBy && (
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>por {d.deliveredBy}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {per ? (
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PersonAvatar name={per.fullName} type={per.personType} />
                              <div className="min-w-0">
                                <p className="font-semibold leading-tight" style={{ color: "#0f172a" }}>{per.fullName}</p>
                                <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>{per.role || (per.personType === "STAFF" ? "Staff" : "Voluntario")}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{d.personId.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="p-3">
                          {prod ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="flex-shrink-0 inline-flex items-center justify-center rounded-lg"
                                style={{
                                  width: 28, height: 28,
                                  background: "linear-gradient(135deg, #fff4d6 0%, #fce6a8 100%)",
                                  color: "#c78c00",
                                  border: "1px solid #c78c0033",
                                }}
                              >
                                <PackageIcon size={14} />
                              </div>
                              <span className="font-medium" style={{ color: "#334155" }}>{prod.name}</span>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{d.productId.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="p-3">
                          {d.size ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold"
                              style={{ background: "#eef4fb", color: "#1f4e8c", border: "1px solid #c7d8ed", minWidth: 24, display: "inline-block", textAlign: "center" }}>{d.size}</span>
                          ) : (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-semibold tabular-nums" style={{ color: "#334155" }}>×{d.quantity}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold tabular-nums text-[13px]" style={{ color: "#0f172a" }}>{fmt$(cost)}</span>
                        </td>
                        <td className="p-3"><ValidationPill at={d.validatedAt} /></td>
                        <td className="p-3">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {pending && (
                              <IconActionButton variant="validate" title="Validar entrega"
                                onClick={() => validateDelivery(d.id)}>
                                Validar
                              </IconActionButton>
                            )}
                            <IconActionButton variant="delete" title="Eliminar entrega"
                              onClick={() => deleteEntity("delivery", d.id)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #cbd5e1", background: "#f8fafc" }}>
                    <td colSpan={5} className="p-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Total entregado
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold tabular-nums text-sm" style={{ color: "#1eb19a" }}>
                        {fmt$(deliveries.reduce((s, d) => s + Number(d.unitCost || 0) * Number(d.quantity || 0), 0))}
                      </span>
                    </td>
                    <td colSpan={2} className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ───────── Modal ───────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }} onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold">
                {(modal.data as any)?.id ? "Editar" : "Nuevo"}{" "}
                {modal.type === "person" ? "persona" : modal.type === "product" ? "producto" : "entrega"}
              </h2>
              <button className="btn btn-ghost text-sm" type="button" onClick={() => setModal(null)}>Cerrar ✕</button>
            </div>

            <div className="p-5">
              {modal.type === "person" && (
                <PersonForm data={modal.data as Partial<Person>}
                  onChange={(d) => setModal({ type: "person", data: d })} />
              )}
              {modal.type === "product" && (
                <ProductForm data={modal.data as Partial<Product>}
                  onChange={(d) => setModal({ type: "product", data: d })} />
              )}
              {modal.type === "delivery" && (
                <DeliveryForm data={modal.data as Partial<Delivery>}
                  persons={persons} products={products}
                  onChange={(d) => setModal({ type: "delivery", data: d })} />
              )}
            </div>

            <div className="p-5 border-t flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
              <button className="btn btn-ghost" type="button" onClick={() => setModal(null)} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={saveEntity} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes UI ────────────────────────────────────────────────────────

function SectionHeader({
  icon, label, sub, accentColor, action,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  accentColor: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center icon-bounce"
          style={{
            background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}30 100%)`,
            color: accentColor,
            border: `1px solid ${accentColor}25`,
            boxShadow: `0 2px 10px ${accentColor}1f`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accentColor }}>
            {label}
          </p>
          {sub && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

function getInitials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function PersonAvatar({ name, type }: { name: string; type: string }) {
  const isStaff = type === "STAFF";
  const gradient = isStaff
    ? "linear-gradient(135deg, #2d6aa8 0%, #1f4e8c 100%)"
    : "linear-gradient(135deg, #7c5ec4 0%, #5e3aab 100%)";
  const shadow = isStaff ? "rgba(31,78,140,0.30)" : "rgba(94,58,171,0.30)";
  return (
    <div
      className="flex-shrink-0 inline-flex items-center justify-center rounded-full font-bold"
      style={{
        width: 34,
        height: 34,
        background: gradient,
        color: "#fff",
        fontSize: 11.5,
        letterSpacing: "0.04em",
        boxShadow: `0 2px 6px ${shadow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ width: 56, height: 4, borderRadius: 4, background: "#e2e8f0", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 220ms ease" }} />
    </div>
  );
}

function ContactCell({ email, phone }: { email?: string | null; phone?: string | null }) {
  if (!email && !phone) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] hover:underline"
          style={{ color: "#334155" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#94a3b8" }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          {email}
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          className="inline-flex items-center gap-1.5 text-[11px] hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#94a3b8" }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          {phone}
        </a>
      )}
    </div>
  );
}

function CategoryChip({ value }: { value: string | null | undefined }) {
  const meta: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    CLOTHING:    { label: "Vestimenta",  bg: "#eef4fb", color: "#1f4e8c", icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></svg>
    )},
    ACCESSORY:   { label: "Accesorio",   bg: "#f4f0fb", color: "#5e3aab", icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    )},
    EQUIPMENT:   { label: "Equipo",      bg: "#fff4d6", color: "#7a4a00", icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
    )},
    UNIFORME:    { label: "Uniforme",    bg: "#eef4fb", color: "#1f4e8c", icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></svg>
    )},
    ACREDITACION:{ label: "Acreditación",bg: "#e7f5ec", color: "#1e5125", icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h3M15 12h3M5 18h14"/></svg>
    )},
    ALIMENTACION:{ label: "Alimentación",bg: "#fde2e2", color: "#7a1313", icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
    )},
  };
  const m = value ? meta[value] : null;
  if (!m) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold"
      style={{ backgroundColor: m.bg, color: m.color, border: `1px solid ${m.color}33` }}>
      {m.icon}
      {m.label}
    </span>
  );
}

function PersonTypeBadge({ type }: { type: string }) {
  const isStaff = type === "STAFF";
  const color = isStaff ? "#1f4e8c" : "#5e3aab";
  const bg    = isStaff ? "#eef4fb" : "#f4f0fb";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}33` }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, boxShadow: `0 0 0 2px ${color}22` }} />
      {isStaff ? "Staff" : "Voluntario"}
    </span>
  );
}

function ValidationPill({ at }: { at: string | null | undefined }) {
  if (at) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold"
        style={{ backgroundColor: "#e7f5ec", color: "#1e5125", border: "1px solid #2e7d3233" }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2e7d32" }} />
        Validada · {new Date(at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold"
      style={{ backgroundColor: "#fff4d6", color: "#7a4a00", border: "1px solid #c78c0033" }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c78c00", animation: "pulse 1.8s infinite" }} />
      Pendiente
    </span>
  );
}

function IconActionButton({
  variant, title, onClick, children, disabled,
}: {
  variant: "edit" | "delete" | "validate" | "print";
  title: string;
  onClick: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const palette: Record<string, { bg: string; color: string; hover: string }> = {
    edit:     { bg: "#eef4fb", color: "#1f4e8c", hover: "#dbe7f5" },
    delete:   { bg: "#fde2e2", color: "#b3231b", hover: "#fbcaca" },
    validate: { bg: "#e7f5ec", color: "#1e5125", hover: "#cfe9d6" },
    print:    { bg: "#f1f5f9", color: "#334155", hover: "#e2e8f0" },
  };
  const s = palette[variant];
  const ICONS: Record<string, React.ReactNode> = {
    edit: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
    delete: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
    ),
    validate: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    print: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    ),
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold rounded-md transition"
      style={{
        background: s.bg,
        color: s.color,
        padding: children ? "5px 9px" : "6px 7px",
        border: `1px solid ${s.color}22`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = s.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = s.bg; }}
    >
      {ICONS[variant]}
      {children}
    </button>
  );
}

// ── Impresión de códigos de barras ───────────────────────────────────────────

function printBarcodeLabels(items: Array<{ name: string; barcode: string; category?: string | null }>) {
  if (items.length === 0) {
    alert("No hay productos con código de barras para imprimir.");
    return;
  }
  // Generar SVG por item con JsBarcode
  const labelsHtml = items.map((it) => {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(svgNode, it.barcode, {
        format: "CODE128",
        width: 2.2,
        height: 70,
        displayValue: true,
        fontSize: 13,
        fontOptions: "bold",
        textMargin: 4,
        margin: 6,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (e) {
      console.error("Barcode error for", it.barcode, e);
      return "";
    }
    const svgString = new XMLSerializer().serializeToString(svgNode);
    return `
      <div class="label">
        <div class="label-brand">SEVEN ARENA · WORKFORCE</div>
        <div class="label-name">${escapeHtml(it.name)}</div>
        ${it.category ? `<div class="label-cat">${escapeHtml(it.category)}</div>` : ""}
        <div class="label-barcode">${svgString}</div>
      </div>
    `;
  }).filter(Boolean).join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Etiquetas — ${items.length} producto(s)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 16px;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #f4f6f9;
      color: #0f172a;
    }
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      background: #0f172a; color: #fff;
      padding: 10px 16px; margin: -16px -16px 16px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toolbar h1 { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }
    .toolbar button {
      background: linear-gradient(135deg, #21D0B3 0%, #15B09A 100%);
      color: #062240; border: none; border-radius: 8px;
      padding: 8px 18px; font-weight: 700; font-size: 13px;
      cursor: pointer; box-shadow: 0 2px 8px rgba(33,208,179,0.4);
    }
    .toolbar button:hover { transform: translateY(-1px); }
    .sheet {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      max-width: 800px; margin: 0 auto;
    }
    .label {
      background: #fff;
      border: 1px dashed #94a3b8;
      border-radius: 8px;
      padding: 12px 14px;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
    }
    .label-brand {
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.18em;
      color: #21D0B3; text-transform: uppercase; margin-bottom: 6px;
    }
    .label-name {
      font-size: 13px; font-weight: 700; color: #0f172a;
      line-height: 1.2; margin-bottom: 2px;
    }
    .label-cat {
      font-size: 9px; font-weight: 600; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;
    }
    .label-barcode {
      display: flex; justify-content: center; align-items: center;
      margin: 4px 0; min-height: 90px;
    }
    .label-barcode svg { max-width: 100%; height: auto; }
    @media print {
      body { padding: 0; background: #fff; }
      .toolbar { display: none; }
      .sheet { gap: 6px; max-width: none; }
      .label { border: 1px dashed #cbd5e1; box-shadow: none; }
      @page { margin: 10mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Etiquetas de productos · ${items.length} ${items.length === 1 ? "etiqueta" : "etiquetas"}</h1>
    <button onclick="window.print()">🖨 Imprimir</button>
  </div>
  <div class="sheet">${labelsHtml}</div>
  <script>
    // Auto-trigger print dialog on load
    window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("No se pudo abrir la ventana de impresión. Habilitá los pop-ups y volvé a intentar.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function PersonForm({ data, onChange }: { data: Partial<Person>; onChange: (d: Partial<Person>) => void }) {
  const set = (k: keyof Person, v: any) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Nombre completo *" className="md:col-span-2">
        <input type="text" className="input" value={data.fullName || ""}
          onChange={(e) => set("fullName", e.target.value)} />
      </Field>
      <Field label="RUT">
        <input type="text" className="input" value={data.rut || ""}
          onChange={(e) => set("rut", e.target.value)} />
      </Field>
      <Field label="Tipo">
        <select className="input" value={data.personType || "STAFF"}
          onChange={(e) => set("personType", e.target.value)}>
          {PERSON_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <Field label="Email">
        <input type="email" className="input" value={data.email || ""}
          onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Teléfono">
        <input type="tel" className="input" value={data.phone || ""}
          onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Género">
        <select className="input" value={data.gender || ""}
          onChange={(e) => set("gender", e.target.value)}>
          <option value="">— Seleccionar —</option>
          {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </Field>
      <Field label="Rol / Cargo">
        <input type="text" className="input" placeholder="Ej: Coordinador logístico"
          value={data.role || ""} onChange={(e) => set("role", e.target.value)} />
      </Field>
      <Field label="Dirección" className="md:col-span-2">
        <input type="text" className="input" value={data.address || ""}
          onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="$/día">
        <input type="number" min={0} className="input" value={data.dailyRate ?? ""}
          onChange={(e) => set("dailyRate", Number(e.target.value) || 0)} />
      </Field>
      <Field label="Cantidad de días">
        <input type="number" min={0} className="input" value={data.daysCount ?? ""}
          onChange={(e) => set("daysCount", Number(e.target.value) || 0)} />
      </Field>
      <Field label="Notas" className="md:col-span-2">
        <textarea rows={2} className="input" value={data.notes || ""}
          onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}

function ProductForm({ data, onChange }: { data: Partial<Product>; onChange: (d: Partial<Product>) => void }) {
  const set = (k: keyof Product, v: any) => onChange({ ...data, [k]: v });
  const [sizeInput, setSizeInput] = useState("");
  const sizes = data.availableSizes || [];
  const addSize = () => {
    if (!sizeInput.trim()) return;
    set("availableSizes", [...sizes, sizeInput.trim()]);
    setSizeInput("");
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Nombre *" className="md:col-span-2">
        <input type="text" className="input" placeholder="Ej: Polera oficial"
          value={data.name || ""} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Categoría">
        <select className="input" value={data.category || ""}
          onChange={(e) => set("category", e.target.value)}>
          <option value="">— Seleccionar —</option>
          {PRODUCT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Código de barras (auto-generado)">
        <div className="input flex items-center gap-2 font-mono"
          style={{
            background: "#f8fafc",
            color: data.barcode ? "#0d1e3a" : "#94a3b8",
            cursor: "not-allowed",
          }}>
          {/* Mini-render visual de barras */}
          {data.barcode && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "1px",
              height: "18px",
            }}>
              {data.barcode.split("").slice(0, 8).map((d, i) => (
                <span key={i} style={{
                  display: "inline-block",
                  width: `${((parseInt(d, 10) % 3) + 1)}px`,
                  height: "100%",
                  background: "#0d1e3a",
                }} />
              ))}
            </span>
          )}
          <span className="tracking-wider">
            {data.barcode || "Se genera al guardar"}
          </span>
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          EAN-13 escaneable. No es editable.
        </p>
      </Field>
      <Field label="Costo unitario ($)">
        <input type="number" min={0} className="input" value={data.unitCost ?? ""}
          onChange={(e) => set("unitCost", Number(e.target.value) || 0)} />
      </Field>
      <Field label="Stock disponible">
        <input type="number" min={0} className="input" value={data.stockQuantity ?? ""}
          onChange={(e) => set("stockQuantity", Number(e.target.value) || 0)} />
      </Field>
      <Field label="¿Maneja tallas?" className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!data.hasSizes}
            onChange={(e) => set("hasSizes", e.target.checked)} />
          Sí, este producto tiene variantes de talla
        </label>
      </Field>
      {data.hasSizes && (
        <Field label="Tallas disponibles" className="md:col-span-2">
          <div className="flex gap-2 flex-wrap items-center mb-2">
            {sizes.map((s, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: "#eef4fb", color: "#1f4e8c" }}>
                {s}
                <button type="button" className="ml-1 text-[10px]"
                  onClick={() => set("availableSizes", sizes.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" className="input flex-1" placeholder="Ej: S, M, L, 38, 42…"
              value={sizeInput} onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }} />
            <button type="button" className="btn btn-ghost" onClick={addSize}>+ Agregar</button>
          </div>
        </Field>
      )}
      <Field label="Descripción" className="md:col-span-2">
        <textarea rows={2} className="input" value={data.description || ""}
          onChange={(e) => set("description", e.target.value)} />
      </Field>
    </div>
  );
}

function DeliveryForm({
  data, persons, products, onChange,
}: {
  data: Partial<Delivery>; persons: Person[]; products: Product[];
  onChange: (d: Partial<Delivery>) => void;
}) {
  const set = (k: keyof Delivery, v: any) => onChange({ ...data, [k]: v });
  const selectedProduct = products.find((p) => p.id === data.productId);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Persona *">
        <select className="input" value={data.personId || ""}
          onChange={(e) => set("personId", e.target.value)}>
          <option value="">— Seleccionar persona —</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} ({p.personType === "STAFF" ? "Staff" : "Voluntario"})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Producto *">
        <select className="input" value={data.productId || ""}
          onChange={(e) => set("productId", e.target.value)}>
          <option value="">— Seleccionar producto —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Cantidad">
        <input type="number" min={1} className="input" value={data.quantity ?? 1}
          onChange={(e) => set("quantity", Number(e.target.value) || 1)} />
      </Field>
      {selectedProduct?.hasSizes && (
        <Field label="Talla">
          <select className="input" value={data.size || ""}
            onChange={(e) => set("size", e.target.value)}>
            <option value="">— Seleccionar talla —</option>
            {(selectedProduct.availableSizes || []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Fecha de entrega">
        <input type="datetime-local" className="input"
          value={data.deliveredAt ? new Date(data.deliveredAt).toISOString().slice(0, 16) : ""}
          onChange={(e) => set("deliveredAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
      </Field>
      <Field label="Entregado por">
        <input type="text" className="input" placeholder="Nombre del operador"
          value={data.deliveredBy || ""} onChange={(e) => set("deliveredBy", e.target.value)} />
      </Field>
      <Field label="Notas" className="md:col-span-2">
        <textarea rows={2} className="input" value={data.notes || ""}
          onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
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
