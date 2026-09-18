"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, PinIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, SURFACE } from "@/lib/design";

/**
 * Calendario deportivo de la región para el Jefe de Misión (portal). El
 * backend entrega sólo las filas donde participa su delegación más las
 * generales (sin delegación); acá se agrupan por día.
 */
type CalendarRow = {
  id: string;
  sport: string;
  league: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  venue?: string | null;
  startAtUtc: string;
  status: string;
};

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

function matchLabel(row: CalendarRow): string {
  const a = row.homeTeam?.trim() ?? "";
  const b = row.awayTeam?.trim() ?? "";
  if (a && b) return `${a} vs ${b}`;
  return a || b || row.league;
}

export default function MissionCalendar({ eventId, delegationName }: { eventId?: string | null; delegationName: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
        const data = await apiFetch<CalendarRow[]>(`/sports-calendar/events${q}`);
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, [eventId]);

  const groups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const visible = rows
      .filter((r) => showPast || new Date(r.startAtUtc).getTime() >= startOfToday.getTime())
      .sort((a, b) => new Date(a.startAtUtc).getTime() - new Date(b.startAtUtc).getTime());
    const map = new Map<string, CalendarRow[]>();
    for (const r of visible) {
      const k = dayKey(r.startAtUtc);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows, showPast]);

  if (!loaded) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
      <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: 14, borderLeft: `4px solid ${BRAND.teal}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 6px" }}>{t("Calendario de mi región")}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{delegationName || "—"}</p>
        <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "3px 0 0" }}>
          {rows.length} {t("encuentro(s) programado(s)")}
          {" · "}
          <button type="button" onClick={() => setShowPast((v) => !v)} style={{ background: "none", border: "none", padding: 0, color: BRAND.tealInk, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            {showPast ? t("Ocultar pasados") : t("Ver pasados")}
          </button>
        </p>
      </div>

      {groups.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center", background: SURFACE.card, borderRadius: 14, border: `1px dashed ${SURFACE.border}` }}>
          <CalendarIcon size={20} color={SURFACE.textFaint} />
          <p style={{ fontSize: 12.5, color: SURFACE.textFaint, margin: "6px 0 0" }}>{t("Aún no hay encuentros cargados para tu región.")}</p>
        </div>
      ) : (
        groups.map(([day, items]) => (
          <div key={day} style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, overflow: "hidden" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SURFACE.textMuted, margin: 0, padding: "10px 14px", borderBottom: `1px solid ${SURFACE.border}` }}>
              {day}
            </p>
            {items.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 12, padding: "10px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
                <div style={{ width: 44, flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: BRAND.tealInk, margin: 0, fontVariantNumeric: "tabular-nums" }}>{timeOf(r.startAtUtc)}</p>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{matchLabel(r)}</p>
                  <p style={{ fontSize: 11.5, color: SURFACE.textMuted, margin: "2px 0 0" }}>{r.sport}{r.league && r.league !== r.sport ? ` · ${r.league}` : ""}</p>
                  {r.venue && (
                    <p style={{ fontSize: 11.5, color: SURFACE.textStrong, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <PinIcon size={11} /> {r.venue}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
