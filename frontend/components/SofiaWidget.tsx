"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { apiFetch, getTokens } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { downloadCSV, downloadChartPng, slugify } from "@/lib/export";

/* ── Sparkle icon ── */
function SofiaBotIcon({ size = 24, eyeColor = "#21D0B3" }: { size?: number; eyeColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="4" width="26" height="20" rx="10" fill="currentColor" />
      <path d="M8 24 C8 24 6 28 4 29 C6 28 10 27 12 25" fill="currentColor" />
      <circle cx="12" cy="14" r="3" fill={eyeColor} />
      <circle cx="20" cy="14" r="3" fill={eyeColor} />
    </svg>
  );
}

/* ── Types ── */
type SofiaArtifact = {
  id: string;
  kind: "chart" | "kpi" | "action" | "live" | "table";
  title?: string;
  note?: string;
  chartType?: "line" | "bar" | "area";
  xKey?: string;
  series?: { key: string; label: string; color?: string }[];
  rows?: Record<string, unknown>[];
  kpis?: { label: string; value: string | number; hint?: string; tone?: string }[];
  action?: {
    tool: string;
    label: string;
    status: "success" | "error";
    summary: string;
    logId?: string;
    undoable?: boolean;
  };
  feed?: "gps" | "trips" | "alerts" | "presence";
  eventId?: string | null;
  columns?: { key: string; label: string }[];
};
type SofiaMessage = { role: "user" | "assistant"; content: string; artifacts?: SofiaArtifact[] };
type StreamChunk = {
  type: "delta" | "done" | "error" | "tool_call" | "render";
  content: string;
  responseId?: string | null;
  artifact?: SofiaArtifact;
};

/* ── Tool-name → friendly progress message ── */
const TOOL_PROGRESS_LABELS: Record<string, string> = {
  // Lectura
  get_summary: "Obteniendo resumen general...",
  query_events: "Buscando eventos...",
  query_delegations: "Buscando delegaciones...",
  query_athletes: "Buscando participantes...",
  query_trips: "Buscando viajes...",
  query_drivers: "Buscando conductores...",
  query_vehicles: "Buscando vehículos...",
  query_accommodations: "Buscando hoteles...",
  query_flights: "Buscando vuelos...",
  query_providers: "Buscando proveedores...",
  query_vehicle_positions: "Consultando posiciones GPS...",
  count_athletes_by_country: "Contando atletas por delegación...",
  count_trips_by_status: "Contando viajes por estado...",
  // Acciones
  create_trip: "Creando viaje...",
  assign_driver_to_trip: "Asignando conductor al viaje...",
  update_trip_status: "Actualizando estado del viaje...",
  cancel_trip: "Cancelando viaje...",
  auto_assign_drivers: "Asignando conductores automáticamente...",
  create_hotel_assignment: "Asignando habitación...",
  release_hotel_assignment: "Liberando habitación...",
  create_premiacion: "Creando premiación...",
  update_premiacion_status: "Actualizando premiación...",
  create_coupon: "Creando cupón...",
  claim_coupon: "Reclamando cupón...",
  send_notification: "Enviando notificación...",
  create_workforce_person: "Registrando personal...",
  create_event: "Creando evento...",
  update_event_status: "Actualizando evento...",
  create_delegation: "Creando delegación...",
  create_athlete: "Registrando participante...",
  update_athlete_status: "Actualizando participante...",
  create_discipline: "Creando disciplina...",
  create_provider: "Creando proveedor...",
  create_venue: "Creando recinto...",
  create_driver: "Registrando conductor...",
  create_vehicle: "Registrando vehículo...",
  create_flight: "Creando vuelo...",
  create_accommodation: "Creando hotel...",
  create_hotel_room: "Creando habitación...",
  create_food_location: "Creando lugar de comida...",
  create_food_menu: "Creando menú...",
  update_accreditation_status: "Actualizando acreditación...",
  undo_last_action: "Deshaciendo última acción...",
  // Analytics
  forecast_trip_demand: "Calculando proyección de demanda...",
  forecast_hotel_occupancy: "Calculando ocupación hotelera...",
  coupon_partners_performance: "Analizando performance de partners...",
  workforce_kpis: "Calculando KPIs de personal...",
  analytics_trips_timeline: "Generando línea de tiempo de viajes...",
  analytics_participants: "Analizando participantes...",
  // Tiempo real
  open_live_map: "Abriendo mapa en vivo...",
  open_live_trips: "Abriendo viajes en vivo...",
  open_alerts_feed: "Abriendo alertas en vivo...",
  open_driver_monitor: "Abriendo monitor de conductores...",
  get_active_alerts: "Revisando alertas activas...",
  get_driver_presence: "Consultando presencia de conductores...",
};

function friendlyToolMessage(raw: string | null): string {
  if (!raw) return "";
  if (TOOL_PROGRESS_LABELS[raw]) return TOOL_PROGRESS_LABELS[raw];
  // Si ya es un mensaje en español (no es snake_case crudo), devolvelo tal cual.
  if (!/^[a-z][a-z0-9_]*$/.test(raw)) return raw;
  return "Procesando...";
}

/* ── API base resolution ── */
function apiCandidates(): string[] {
  if (typeof window === "undefined") return [];
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase) return [envBase];
  const proto = window.location.protocol;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1")
    return [`${proto}//localhost:3000`, `${proto}//localhost:3001`];
  return [`${proto}//${host}:3000`, `${proto}//${host}:3001`, `${proto}//${host}:3002`];
}

let preferredBase: string | null = null;
function resolveBase(): string {
  return preferredBase || apiCandidates()[0] || "";
}

async function fetchStream(
  path: string,
  body: Record<string, unknown>,
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal,
) {
  const tokens = getTokens();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens?.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  const bases = [...(preferredBase ? [preferredBase] : []), ...apiCandidates().filter((b) => b !== preferredBase)];
  let response: Response | null = null;
  for (const base of bases) {
    try {
      response = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal });
      preferredBase = base;
      break;
    } catch {
      continue;
    }
  }
  if (!response) throw new Error("No se pudo conectar con la API");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const readPromise = reader.read();
    const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
      setTimeout(() => reject(new Error("Stream timeout")), 35000);
    });
    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        onChunk(JSON.parse(jsonStr));
      } catch {}
    }
  }
}

/* ── Notification chime ── */
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.04);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.35);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

/* ════════════════════════════════════════════════════════════════ */
/*  Artifact renderers                                                */
/* ════════════════════════════════════════════════════════════════ */

const CHART_AXIS = { fill: "rgba(255,255,255,0.55)", fontSize: 10 };

function ExportButtons({ onCsv, onPng }: { onCsv: () => void; onPng?: () => void }) {
  const btn = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 7,
    padding: "3px 9px",
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  } as const;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      <button type="button" style={btn} onClick={onCsv} title="Descargar datos en CSV">
        ⬇ CSV
      </button>
      {onPng && (
        <button type="button" style={btn} onClick={onPng} title="Descargar gráfico en PNG">
          ⬇ PNG
        </button>
      )}
    </div>
  );
}

function ChartArtifact({ artifact }: { artifact: SofiaArtifact }) {
  const rows = artifact.rows ?? [];
  const series = artifact.series ?? [];
  const xKey = artifact.xKey ?? "date";
  const exportCsv = () => {
    const cols = [xKey, ...series.map((s) => s.key)];
    downloadCSV(slugify(artifact.title || "datos-sofia"), rows, cols);
  };
  const exportPng = () => {
    downloadChartPng(
      { title: artifact.title, chartType: artifact.chartType, xKey, series, rows },
      slugify(artifact.title || "grafico-sofia"),
    );
  };

  if (rows.length === 0) {
    return <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Sin datos para graficar.</p>;
  }
  const tooltipStyle = {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    fontSize: 11,
    color: "#f1f5f9",
  };

  return (
    <div style={{ width: "100%", marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <ExportButtons onCsv={exportCsv} onPng={exportPng} />
      </div>
      <ResponsiveContainer width="100%" height={190}>
        {artifact.chartType === "bar" ? (
          <BarChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey={xKey} tick={CHART_AXIS} stroke="rgba(255,255,255,0.2)" />
            <YAxis tick={CHART_AXIS} stroke="rgba(255,255,255,0.2)" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <Legend wrapperStyle={{ fontSize: 10, color: "#cbd5e1" }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || "#21D0B3"} stackId="a" radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        ) : artifact.chartType === "area" ? (
          <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey={xKey} tick={CHART_AXIS} stroke="rgba(255,255,255,0.2)" />
            <YAxis tick={CHART_AXIS} stroke="rgba(255,255,255,0.2)" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10, color: "#cbd5e1" }} />
            {series.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color || "#21D0B3"}
                fill={s.color || "#21D0B3"}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey={xKey} tick={CHART_AXIS} stroke="rgba(255,255,255,0.2)" />
            <YAxis tick={CHART_AXIS} stroke="rgba(255,255,255,0.2)" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10, color: "#cbd5e1" }} />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color || "#21D0B3"}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function KpiRow({ kpis }: { kpis: NonNullable<SofiaArtifact["kpis"]> }) {
  const toneColor = (tone?: string) =>
    tone === "good" ? "#21D0B3" : tone === "warn" ? "#f59e0b" : "#e2e8f0";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {kpis.map((k, i) => (
        <div
          key={i}
          style={{
            flex: "1 1 96px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {k.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: toneColor(k.tone), marginTop: 2 }}>{k.value}</div>
          {k.hint && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>{k.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function ActionCard({
  action,
  onUndo,
}: {
  action: NonNullable<SofiaArtifact["action"]>;
  onUndo: (logId?: string) => void;
}) {
  const ok = action.status === "success";
  return (
    <div
      style={{
        marginTop: 6,
        background: ok ? "rgba(33,208,179,0.08)" : "rgba(244,63,94,0.1)",
        border: `1px solid ${ok ? "rgba(33,208,179,0.25)" : "rgba(244,63,94,0.3)"}`,
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{ok ? "✅" : "⚠️"}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: ok ? "#21D0B3" : "#fb7185" }}>
          {action.label}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", margin: "5px 0 0", lineHeight: 1.5 }}>
        {action.summary}
      </p>
      {ok && action.undoable && (
        <button
          type="button"
          onClick={() => onUndo(action.logId)}
          style={{
            marginTop: 7,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8,
            padding: "4px 12px",
            color: "rgba(255,255,255,0.7)",
            fontSize: 10.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ↩ Deshacer
        </button>
      )}
    </div>
  );
}

/* ── Live feed panels (open their own SSE connection) ── */
type GpsDriver = { driverId: string; name: string; lat: number; lng: number; speed: number; ageSeconds: number; stale: boolean };
type LiveTrip = { id: string; origin: string; destination: string; status: string; driver: string | null; scheduledAt: string | null };
type Alert = { level: "high" | "warn"; type: string; message: string; ref?: string };

function useLiveFeed<T>(feed: string, eventId: string | null | undefined, extract: (snap: unknown) => T) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const url = `${resolveBase()}/sofia/live?feed=${feed}&eventId=${eventId ?? ""}`;
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onmessage = (ev) => {
      try {
        setData(extract(JSON.parse(ev.data)));
      } catch {}
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, eventId]);
  return { data, connected };
}

function LiveBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, color: connected ? "#21D0B3" : "rgba(255,255,255,0.4)" }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: connected ? "#21D0B3" : "#64748b",
          boxShadow: connected ? "0 0 6px #21D0B3" : "none",
        }}
      />
      {connected ? "EN VIVO" : "Conectando…"}
    </span>
  );
}

function loadGoogleMapsApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (w.google?.maps?.Map) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function LiveMapPanel({ eventId }: { eventId: string | null | undefined }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const { data, connected } = useLiveFeed<GpsDriver[]>("gps", eventId, (snap) =>
    ((snap as { drivers?: GpsDriver[] }).drivers ?? []).filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng)),
  );

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsApi().then(() => {
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      const google = (window as any).google;
      mapRef.current = new google.maps.Map(mapDivRef.current, {
        center: { lat: -33.45, lng: -70.66 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    });
    return () => {
      cancelled = true;
      Object.values(markersRef.current).forEach((m: any) => m.setMap(null));
      markersRef.current = {};
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps || !data) return;
    const seen = new Set<string>();
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;
    data.forEach((d) => {
      seen.add(d.driverId);
      bounds.extend({ lat: d.lat, lng: d.lng });
      hasBounds = true;
      const color = d.stale ? "#f59e0b" : "#21D0B3";
      const icon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      };
      const title = `${d.name} · ${Math.round(d.speed)} km/h`;
      const existing = markersRef.current[d.driverId];
      if (existing) {
        existing.setPosition({ lat: d.lat, lng: d.lng });
        existing.setIcon(icon);
        existing.setTitle(title);
      } else {
        markersRef.current[d.driverId] = new google.maps.Marker({
          position: { lat: d.lat, lng: d.lng },
          map,
          icon,
          title,
        });
      }
    });
    Object.entries(markersRef.current).forEach(([id, m]: [string, any]) => {
      if (!seen.has(id)) {
        m.setMap(null);
        delete markersRef.current[id];
      }
    });
    if (hasBounds) map.fitBounds(bounds, { top: 28, right: 28, bottom: 28, left: 28 });
  }, [data]);

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <LiveBadge connected={connected} />
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>
          {data ? `${data.length} conductor(es)` : "—"}
        </span>
      </div>
      <div
        ref={mapDivRef}
        style={{ width: "100%", height: 210, borderRadius: 12, overflow: "hidden", background: "#0f172a" }}
      />
    </div>
  );
}

const TRIP_STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "#6366f1",
  IN_PROGRESS: "#21D0B3",
  PICKED_UP: "#0ea5e9",
  REQUESTED: "#f59e0b",
};

function LiveTripsPanel({ eventId }: { eventId: string | null | undefined }) {
  const { data, connected } = useLiveFeed<LiveTrip[]>("trips", eventId, (snap) => (snap as { trips?: LiveTrip[] }).trips ?? []);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <LiveBadge connected={connected} />
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>{data ? `${data.length} viaje(s)` : "—"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
        {(data ?? []).map((t) => (
          <div
            key={t.id}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 9,
              padding: "7px 10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                {t.origin} → {t.destination}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: TRIP_STATUS_COLOR[t.status] || "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                {t.status}
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.42)", marginTop: 2 }}>
              {t.driver ? `Conductor: ${t.driver}` : "Sin conductor"}
              {t.scheduledAt ? ` · ${new Date(t.scheduledAt).toLocaleString("es-CL")}` : ""}
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>No hay viajes en curso.</p>
        )}
      </div>
    </div>
  );
}

function AlertsPanel({ eventId }: { eventId: string | null | undefined }) {
  const { data, connected } = useLiveFeed<Alert[]>("alerts", eventId, (snap) => (snap as { alerts?: Alert[] }).alerts ?? []);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <LiveBadge connected={connected} />
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>{data ? `${data.length} alerta(s)` : "—"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
        {(data ?? []).map((a, i) => {
          const high = a.level === "high";
          return (
            <div
              key={i}
              style={{
                background: high ? "rgba(244,63,94,0.1)" : "rgba(245,158,11,0.1)",
                border: `1px solid ${high ? "rgba(244,63,94,0.28)" : "rgba(245,158,11,0.28)"}`,
                borderRadius: 9,
                padding: "7px 10px",
                display: "flex",
                gap: 7,
              }}
            >
              <span style={{ fontSize: 12 }}>{high ? "🔴" : "🟡"}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.45 }}>{a.message}</span>
            </div>
          );
        })}
        {data && data.length === 0 && (
          <p style={{ fontSize: 11, color: "#21D0B3" }}>Sin alertas: operación en orden.</p>
        )}
      </div>
    </div>
  );
}

type PresenceDriver = {
  driverId: string;
  fullName: string;
  online: boolean;
  secondsSinceSeen: number | null;
  activeTrips: number;
  platform: string | null;
};

function PresencePanel({ eventId }: { eventId: string | null | undefined }) {
  const { data, connected } = useLiveFeed<PresenceDriver[]>("presence", eventId, (snap) =>
    (snap as { drivers?: PresenceDriver[] }).drivers ?? [],
  );
  const online = (data ?? []).filter((d) => d.online);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <LiveBadge connected={connected} />
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>
          {data ? `${online.length} de ${data.length} conectados` : "—"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
        {(data ?? []).map((d) => (
          <div
            key={d.driverId}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 9,
              padding: "7px 10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: d.online ? "#21D0B3" : "#64748b",
                  boxShadow: d.online ? "0 0 6px #21D0B3" : "none",
                }}
              />
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{d.fullName}</span>
            </div>
            <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
              {d.online ? "Conectado" : "Desconectado"}
              {d.activeTrips > 0 ? ` · ${d.activeTrips} viaje(s)` : ""}
            </span>
          </div>
        ))}
        {data && data.length === 0 && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>No hay conductores registrados.</p>
        )}
      </div>
    </div>
  );
}

function ArtifactView({ artifact, onUndo }: { artifact: SofiaArtifact; onUndo: (logId?: string) => void }) {
  const wrap = (children: React.ReactNode) => (
    <div
      style={{
        marginTop: 8,
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      {artifact.title && (
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>
          {artifact.title}
        </div>
      )}
      {children}
      {artifact.note && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>{artifact.note}</div>
      )}
    </div>
  );

  if (artifact.kind === "action" && artifact.action) {
    return <ActionCard action={artifact.action} onUndo={onUndo} />;
  }
  if (artifact.kind === "chart") {
    return wrap(
      <>
        <ChartArtifact artifact={artifact} />
        {artifact.kpis && artifact.kpis.length > 0 && <KpiRow kpis={artifact.kpis} />}
      </>,
    );
  }
  if (artifact.kind === "kpi" && artifact.kpis) {
    return wrap(<KpiRow kpis={artifact.kpis} />);
  }
  if (artifact.kind === "live") {
    if (artifact.feed === "gps") return wrap(<LiveMapPanel eventId={artifact.eventId} />);
    if (artifact.feed === "trips") return wrap(<LiveTripsPanel eventId={artifact.eventId} />);
    if (artifact.feed === "presence") return wrap(<PresencePanel eventId={artifact.eventId} />);
    return wrap(<AlertsPanel eventId={artifact.eventId} />);
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════ */
/*  Main widget                                                       */
/* ════════════════════════════════════════════════════════════════ */

export default function SofiaWidget() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SofiaMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolInfo, setToolInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(true);
      playChime();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, toolInfo]);

  const addArtifact = (artifact: SofiaArtifact) => {
    setMessages((prev) => {
      const u = [...prev];
      const last = u[u.length - 1];
      if (last?.role === "assistant") {
        u[u.length - 1] = { ...last, artifacts: [...(last.artifacts ?? []), artifact] };
      }
      return u;
    });
  };

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const question = (textOverride ?? input).trim();
      if (!question || loading) return;
      setError(null);
      if (!textOverride) setInput("");
      setToolInfo(null);
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setLoading(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const isLocal =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          /^192\.168\./.test(window.location.hostname));

      if (isLocal) {
        const controller = new AbortController();
        abortRef.current = controller;
        let streamWorked = false;
        try {
          await fetchStream(
            "/sofia/ask-stream",
            { question, previousResponseId: responseId, locale },
            (chunk) => {
              streamWorked = true;
              switch (chunk.type) {
                case "delta":
                  setMessages((prev) => {
                    const u = [...prev];
                    const l = u[u.length - 1];
                    if (l?.role === "assistant") u[u.length - 1] = { ...l, content: l.content + chunk.content };
                    return u;
                  });
                  break;
                case "render":
                  if (chunk.artifact) addArtifact(chunk.artifact);
                  break;
                case "tool_call":
                  setToolInfo(chunk.content);
                  break;
                case "done":
                  if (chunk.responseId) setResponseId(chunk.responseId);
                  setToolInfo(null);
                  break;
                case "error":
                  setError(chunk.content);
                  break;
              }
            },
            controller.signal,
          );
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            setMessages((p) => {
              const l = p[p.length - 1];
              return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p;
            });
            setLoading(false);
            abortRef.current = null;
            return;
          }
          if (!streamWorked) {
            try {
              const result = await apiFetch<{ answer: string; responseId?: string | null; artifacts?: SofiaArtifact[] }>(
                "/sofia/ask",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ question, previousResponseId: responseId, locale }),
                },
              );
              setMessages((p) => {
                const u = [...p];
                u[u.length - 1] = { role: "assistant", content: result.answer, artifacts: result.artifacts ?? [] };
                return u;
              });
              setResponseId(result.responseId ?? null);
            } catch (fe) {
              setError(fe instanceof Error ? fe.message : t("No se pudo cargar"));
              setMessages((p) => {
                const l = p[p.length - 1];
                return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p;
              });
            }
          } else {
            setError(err instanceof Error ? err.message : t("No se pudo cargar"));
            setMessages((p) => {
              const l = p[p.length - 1];
              return l?.role === "assistant" && !l.content && !(l.artifacts && l.artifacts.length) ? p.slice(0, -1) : p;
            });
          }
        } finally {
          setLoading(false);
          abortRef.current = null;
        }
      } else {
        try {
          setToolInfo("Consultando...");
          const result = await apiFetch<{ answer: string; responseId?: string | null; artifacts?: SofiaArtifact[] }>(
            "/sofia/ask",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question, previousResponseId: responseId, locale }),
            },
          );
          setMessages((p) => {
            const u = [...p];
            u[u.length - 1] = { role: "assistant", content: result.answer, artifacts: result.artifacts ?? [] };
            return u;
          });
          setResponseId(result.responseId ?? null);
          setToolInfo(null);
        } catch (fe) {
          setError(fe instanceof Error ? fe.message : t("No se pudo cargar"));
          setMessages((p) => {
            const l = p[p.length - 1];
            return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p;
          });
        } finally {
          setLoading(false);
        }
      }
    },
    [input, loading, responseId, t, locale],
  );

  const handleUndo = useCallback(
    (logId?: string) => {
      sendMessage(logId ? `Deshacé la acción con logId ${logId}.` : "Deshacé la última acción.");
    },
    [sendMessage],
  );

  const quickPrompts = [
    "Pronostica la demanda de viajes de la próxima semana",
    "Abre el mapa en vivo de conductores",
    "Muéstrame las alertas operativas ahora",
    "Analiza el desempeño de cupones y partners",
  ];

  return (
    <>
      {/* ── Welcome toast ── */}
      {showWelcome && (
        <div
          onClick={() => {
            setShowWelcome(false);
            setOpen(true);
          }}
          style={{
            position: "fixed",
            bottom: 100,
            right: 24,
            zIndex: 41,
            maxWidth: 280,
            padding: "14px 18px",
            borderRadius: 16,
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 32px rgba(15,23,42,0.15), 0 0 0 1px rgba(33,208,179,0.1)",
            cursor: "pointer",
            animation: "sofiaToastIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#30455B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <div style={{ color: "#fff" }}>
                <SofiaBotIcon size={20} eyeColor="#21D0B3" />
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Sof</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#21D0B3" }}> IA</span>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "#475569", margin: 0, lineHeight: 1.5 }}>
            Ahora ejecuto acciones, predigo demanda y muestro mapas en vivo. Toca para empezar.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowWelcome(false);
            }}
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: 14,
              cursor: "pointer",
              padding: 2,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── FAB ── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 40 }}>
        {!open && (
          <div
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              border: "2px solid rgba(33,208,179,0.4)",
              animation: "sofiaRing 2.5s ease-out infinite",
              pointerEvents: "none",
            }}
          />
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setShowWelcome(false);
          }}
          style={{
            position: "relative",
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: open ? "linear-gradient(135deg, #e2e8f0, #f1f5f9)" : "#30455B",
            border: open ? "1px solid #cbd5e1" : "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            boxShadow: open
              ? "0 2px 8px rgba(0,0,0,0.1)"
              : "0 4px 24px rgba(48,69,91,0.35), 0 8px 32px rgba(15,23,42,0.2)",
            transition: "all 200ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ color: "#fff" }}>
                <SofiaBotIcon size={44} eyeColor="#21D0B3" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: -1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", fontFamily: "system-ui" }}>
                  Sof
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#21D0B3", letterSpacing: "0.02em" }}>IA</span>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* ── Chat panel ── */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            right: 24,
            zIndex: 50,
            width: 400,
            borderRadius: 20,
            overflow: "hidden",
            background: "linear-gradient(180deg, #1e293b 0%, #263548 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)",
            animation: "sofiaToastIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(33,208,179,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: "#30455B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ color: "#fff" }}>
                    <SofiaBotIcon size={24} eyeColor="#21D0B3" />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800 }}>Sof</span>
                    <span style={{ color: "#21D0B3", fontSize: 16, fontWeight: 900, textShadow: "0 0 8px rgba(33,208,179,0.4)" }}>
                      IA
                    </span>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, margin: 0 }}>
                    Inteligencia operativa
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setResponseId(null);
                    setToolInfo(null);
                    setError(null);
                    setInput("");
                  }}
                  disabled={messages.length === 0 && !error && !toolInfo}
                  title={t("Nueva conversación")}
                  style={{
                    background: "rgba(33,208,179,0.08)",
                    border: "1px solid rgba(33,208,179,0.2)",
                    borderRadius: 8,
                    padding: "5px 10px",
                    color: messages.length === 0 ? "rgba(255,255,255,0.25)" : "#21D0B3",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: messages.length === 0 ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "all 150ms ease",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  {t("Nueva")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "5px 12px",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t("Cerrar")}
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              minHeight: "min(460px, 58vh)",
              maxHeight: "72vh",
              overflowY: "auto",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "transparent",
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ color: "rgba(255,255,255,0.6)" }}>
                      <SofiaBotIcon size={18} eyeColor="#21D0B3" />
                    </div>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    Consulto datos, <strong style={{ color: "#21D0B3" }}>ejecuto acciones</strong>, genero
                    pronósticos y abro paneles en tiempo real. Prueba:
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sendMessage(p)}
                      style={{
                        background: "rgba(33,208,179,0.08)",
                        border: "1px solid rgba(33,208,179,0.2)",
                        borderRadius: 9,
                        padding: "6px 10px",
                        color: "#9be8db",
                        fontSize: 11,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) =>
              msg.role === "assistant" ? (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    padding: "12px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      flexShrink: 0,
                      marginTop: 1,
                      background: "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ color: "rgba(255,255,255,0.6)" }}>
                      <SofiaBotIcon size={16} eyeColor="#21D0B3" />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        fontSize: 13,
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content || (loading && i === messages.length - 1 ? "" : "...")}
                    </div>
                    {msg.artifacts?.map((a) => (
                      <ArtifactView key={a.id} artifact={a} onUndo={handleUndo} />
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  style={{
                    background: "rgba(33,208,179,0.12)",
                    border: "1px solid rgba(33,208,179,0.2)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    marginLeft: 34,
                    color: "#21D0B3",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {msg.content}
                </div>
              ),
            )}
            {toolInfo && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "6px 12px",
                  background: "rgba(33,208,179,0.06)",
                  borderRadius: 8,
                  border: "1px solid rgba(33,208,179,0.12)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
                <span style={{ color: "#21D0B3", fontSize: 11.5, fontWeight: 600 }}>{friendlyToolMessage(toolInfo)}</span>
              </div>
            )}
            {loading && !toolInfo && messages[messages.length - 1]?.content === "" && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0" }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#21D0B3",
                      animation: `sofiaRing 1s ease-in-out infinite ${i * 0.2}s`,
                      display: "inline-block",
                    }}
                  />
                ))}
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 4 }}>
                  {t("Preparando respuesta...")}
                </span>
              </div>
            )}
            {error && <p style={{ color: "#f43f5e", fontSize: 12, margin: 0 }}>{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px 16px 16px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f1f5f9",
                  fontSize: 13,
                  outline: "none",
                }}
                placeholder={t("Escribe tu pregunta")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  background: loading ? "rgba(33,208,179,0.2)" : "linear-gradient(135deg, #21D0B3, #14AE98)",
                  color: loading ? "#21D0B3" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 2px 12px rgba(33,208,179,0.35)",
                }}
              >
                {loading ? "···" : t("Enviar")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes sofiaRing {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        @keyframes sofiaToastIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
