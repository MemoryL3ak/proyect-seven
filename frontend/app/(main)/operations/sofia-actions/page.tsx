"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { downloadCSV } from "@/lib/export";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import EmptyStateBox from "@/components/ui/EmptyState";
import {
  SparkleIcon,
  CheckIcon,
  AlertIcon,
  RefreshIcon,
  UploadIcon,
  ClipboardIcon,
} from "@/components/ui/Icons";

type ActionLogEntry = {
  id: string;
  tool: string;
  status: "success" | "error";
  summary: string | null;
  error: string | null;
  undoable: boolean;
  undone: boolean;
  created_at: string;
};

const TOOL_LABELS: Record<string, string> = {
  create_trip: "Crear viaje",
  assign_driver_to_trip: "Asignar conductor",
  update_trip_status: "Actualizar estado de viaje",
  cancel_trip: "Cancelar viaje",
  auto_assign_drivers: "Asignación automática",
  create_hotel_assignment: "Asignar hotel",
  release_hotel_assignment: "Liberar hotel",
  create_premiacion: "Crear premiación",
  update_premiacion_status: "Actualizar premiación",
  create_coupon: "Crear cupón",
  claim_coupon: "Reclamar cupón",
  send_notification: "Enviar notificación",
  create_workforce_person: "Registrar personal",
  undo_last_action: "Deshacer acción",
};

export default function SofiaActionsPage() {
  const [entries, setEntries] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ActionLogEntry[]>("/sofia/action-log?limit=200");
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el registro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  const exportCsv = useCallback(() => {
    if (entries.length === 0) return;
    downloadCSV(
      `sofia-acciones-${new Date().toISOString().slice(0, 10)}`,
      entries.map((e) => ({
        accion: TOOL_LABELS[e.tool] ?? e.tool,
        estado: e.status === "success" ? "Ejecutada" : "Error",
        detalle: e.summary || e.error || "",
        reversible: e.undoable ? "si" : "no",
        deshecha: e.undone ? "si" : "no",
        fecha: new Date(e.created_at).toLocaleString("es-CL"),
      })),
    );
  }, [entries]);

  const stats = useMemo(() => {
    const total = entries.length;
    const ok = entries.filter((e) => e.status === "success").length;
    const failed = entries.filter((e) => e.status === "error").length;
    const undone = entries.filter((e) => e.undone).length;
    return { total, ok, failed, undone };
  }, [entries]);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Acciones de SofIA"
        description="Registro de auditoría de cada operación que el asistente ejecutó en la plataforma: viajes, hoteles, premiaciones, cupones, notificaciones y más."
        icon={<SparkleIcon size={24} />}
        meta={
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Actualización automática cada 20 s
          </span>
        }
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={exportCsv}
              disabled={entries.length === 0}
              className="btn btn-ghost"
            >
              <UploadIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
              Exportar CSV
            </button>
            <button type="button" onClick={load} className="btn btn-ghost">
              <RefreshIcon size={15} className="inline-block mr-1.5 -mt-0.5" />
              Refrescar
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Acciones totales" value={stats.total} icon={<ClipboardIcon size={18} />} accent="blue" />
        <KpiCard label="Exitosas" value={stats.ok} icon={<CheckIcon size={18} />} accent="green" />
        <KpiCard
          label="Con error"
          value={stats.failed}
          icon={<AlertIcon size={18} />}
          accent={stats.failed > 0 ? "red" : "neutral"}
        />
        <KpiCard label="Deshechas" value={stats.undone} icon={<RefreshIcon size={18} />} accent="amber" />
      </section>

      {error && (
        <section
          className="surface rounded-2xl p-4"
          style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}
        >
          <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
          <p className="text-xs mt-1" style={{ color: "#7a1313", opacity: 0.8 }}>
            Verifica que la migración 20260519_sofia_ai_actions.sql haya sido aplicada.
          </p>
        </section>
      )}

      {loading && entries.length === 0 ? (
        <section className="surface rounded-2xl p-8">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando registro…</p>
        </section>
      ) : entries.length === 0 && !error ? (
        <EmptyStateBox
          icon={<SparkleIcon size={36} />}
          title="SofIA todavía no ejecutó ninguna acción"
          description="Cuando el asistente cree un viaje, asigne un hotel o ejecute cualquier otra operación, quedará registrada acá para auditoría."
        />
      ) : entries.length > 0 ? (
        <div className="surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ backgroundColor: "#1f4e8c", color: "#fff" }}>
                <tr>
                  <th className="p-3 text-left">Acción</th>
                  <th className="p-3 text-left">Detalle</th>
                  <th className="p-3 text-left">Estado</th>
                  <th className="p-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className={`align-top ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="p-3 whitespace-nowrap font-medium">
                      {TOOL_LABELS[e.tool] ?? e.tool}
                    </td>
                    <td className="p-3" style={{ maxWidth: 420, color: "var(--text-muted)" }}>
                      {e.summary || e.error || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={
                            e.status === "success"
                              ? { backgroundColor: "#e7f5ec", color: "#2e7d32" }
                              : { backgroundColor: "#fde2e2", color: "#b3231b" }
                          }
                        >
                          {e.status === "success" ? "Ejecutada" : "Error"}
                        </span>
                        {e.undone && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: "#fff4d6", color: "#c78c00" }}
                          >
                            Deshecha
                          </span>
                        )}
                        {!e.undone && e.undoable && e.status === "success" && (
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Reversible
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {new Date(e.created_at).toLocaleString("es-CL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
