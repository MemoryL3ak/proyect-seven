"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/**
 * Asignar hotel a toda una selección: región más deporte, de una vez.
 *
 * El formulario de abajo crea la asignación de UNA persona. La distribución
 * del evento no se decide así: se decide por región y deporte, como en la
 * planilla de damas y varones. Esto hace ese movimiento en un paso y además
 * deja la celda guardada en la planilla, para que las dos vistas digan lo
 * mismo.
 */
type Evento = { id: string; name?: string | null };
type Delegacion = { id: string; eventId?: string | null; countryCode?: string | null; name?: string | null };
type Disciplina = {
  id: string;
  eventId?: string | null;
  name?: string | null;
  gender?: string | null;
  category?: string | null;
  parentId?: string | null;
};
type Hotel = { id: string; eventId?: string | null; name?: string | null };
type Conteo = { total: number; conHotel: number };

const etiquetaDisciplina = (d: Disciplina) => {
  const nombre = (d.name ?? "").trim();
  const cat = String(d.category ?? "").toUpperCase() === "PARALYMPIC" ? "Para " : "";
  const gen = String(d.gender ?? "").toUpperCase();
  const rama = gen === "FEMALE" ? " · Damas" : gen === "MALE" ? " · Varones" : "";
  return `${cat}${nombre}${rama}`;
};

const nombreCorto = (v: string) => v.replace(/^regi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, "").trim() || v;

export default function AsignarPorGrupo({ onAsignado }: { onAsignado?: () => void }) {
  const { t } = useI18n();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [hoteles, setHoteles] = useState<Hotel[]>([]);

  const [eventoId, setEventoId] = useState("");
  const [delegacionId, setDelegacionId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [rama, setRama] = useState<"DAMAS" | "VARONES">("DAMAS");

  const [conteo, setConteo] = useState<Conteo | null>(null);
  const [asignando, setAsignando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [ev, del, dis, hot] = await Promise.all([
        apiFetch<Evento[]>("/events").catch(() => [] as Evento[]),
        apiFetch<Delegacion[]>("/delegations").catch(() => [] as Delegacion[]),
        apiFetch<Disciplina[]>("/disciplines").catch(() => [] as Disciplina[]),
        apiFetch<Hotel[]>("/accommodations").catch(() => [] as Hotel[]),
      ]);
      setEventos(Array.isArray(ev) ? ev : []);
      setDelegaciones(Array.isArray(del) ? del : []);
      setDisciplinas(Array.isArray(dis) ? dis : []);
      setHoteles(Array.isArray(hot) ? hot : []);
      if (Array.isArray(ev) && ev.length) setEventoId((v) => v || ev[0].id);
    })();
  }, []);

  const regiones = useMemo(
    () =>
      delegaciones
        .filter((d) => !eventoId || d.eventId === eventoId)
        .sort((a, b) => (a.name ?? a.countryCode ?? "").localeCompare(b.name ?? b.countryCode ?? "")),
    [delegaciones, eventoId],
  );

  const deportes = useMemo(
    () =>
      disciplinas
        .filter((d) => (!eventoId || d.eventId === eventoId) && !d.parentId)
        .sort((a, b) => etiquetaDisciplina(a).localeCompare(etiquetaDisciplina(b))),
    [disciplinas, eventoId],
  );

  const alojamientos = useMemo(
    () =>
      hoteles
        .filter((h) => !eventoId || h.eventId === eventoId)
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [hoteles, eventoId],
  );

  const deporteElegido = deportes.find((d) => d.id === disciplinaId);
  const esMixto = !deporteElegido || String(deporteElegido.gender ?? "").toUpperCase() === "MIXED";

  // Cuántos participantes hay en la selección, antes de mover a nadie.
  useEffect(() => {
    if (!eventoId || !delegacionId || !disciplinaId) {
      setConteo(null);
      return;
    }
    let vivo = true;
    void apiFetch<Conteo>(
      `/delegation-hotels/group-count?eventId=${encodeURIComponent(eventoId)}&delegationId=${encodeURIComponent(delegacionId)}&disciplineId=${encodeURIComponent(disciplinaId)}`,
    )
      .then((c) => { if (vivo) setConteo(c); })
      .catch(() => { if (vivo) setConteo(null); });
    return () => { vivo = false; };
  }, [eventoId, delegacionId, disciplinaId]);

  const asignar = async () => {
    if (!eventoId || !delegacionId || !disciplinaId || !hotelId) return;
    setAsignando(true);
    setAviso(null);
    setError(null);
    try {
      const r = await apiFetch<{ actualizados: number; creados: number; total: number }>(
        "/delegation-hotels/assign-group",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: eventoId,
            delegationId: delegacionId,
            disciplineId: disciplinaId,
            accommodationId: hotelId,
            branch: esMixto ? rama : undefined,
          }),
        },
      );
      setAviso(
        r.total === 0
          ? t("La selección no tiene participantes todavía; se guardó igual en la planilla.")
          : `${r.creados} ${t("asignados")}, ${r.actualizados} ${t("cambiados de hotel")}.`,
      );
      setConteo((c) => (c ? { ...c, conHotel: r.total } : c));
      onAsignado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo asignar."));
    } finally {
      setAsignando(false);
    }
  };

  const listo = Boolean(eventoId && delegacionId && disciplinaId && hotelId);

  return (
    <section className="surface rounded-2xl p-5 space-y-4">
      <div>
        <p className="section-label">{t("Asignar por región y disciplina")}</p>
        <p className="text-xs text-white/50 mt-1">
          {t("Deja a toda una selección en el mismo hotel y guarda la celda en la planilla. Para cargar la distribución completa, usa la pestaña «Por delegación y disciplina».")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-white/60">
          {t("Evento")}
          <select className="input" value={eventoId} onChange={(e) => { setEventoId(e.target.value); setDelegacionId(""); setDisciplinaId(""); setHotelId(""); }}>
            <option value="">{t("Selecciona una opción")}</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.name ?? ev.id}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/60">
          {t("Región")}
          <select className="input" value={delegacionId} onChange={(e) => setDelegacionId(e.target.value)}>
            <option value="">{t("Selecciona una opción")}</option>
            {regiones.map((d) => (
              <option key={d.id} value={d.id}>{nombreCorto(d.name || d.countryCode || d.id)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/60">
          {t("Disciplina")}
          <select className="input" value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}>
            <option value="">{t("Selecciona una opción")}</option>
            {deportes.map((d) => <option key={d.id} value={d.id}>{etiquetaDisciplina(d)}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/60">
          {t("Hotel / Villa")}
          <select className="input" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            <option value="">{t("Selecciona una opción")}</option>
            {alojamientos.map((h) => <option key={h.id} value={h.id}>{h.name ?? h.id}</option>)}
          </select>
        </label>

        {/* Los deportes mixtos no dicen la rama: hay que elegirla, porque la
            planilla de damas y la de varones pueden ir a hoteles distintos. */}
        {esMixto && disciplinaId && (
          <label className="flex flex-col gap-1 text-xs text-white/60">
            {t("Rama")}
            <select className="input" value={rama} onChange={(e) => setRama(e.target.value as "DAMAS" | "VARONES")}>
              <option value="DAMAS">{t("Damas")}</option>
              <option value="VARONES">{t("Varones")}</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={!listo || asignando} onClick={() => void asignar()}>
          {asignando
            ? t("Asignando...")
            : conteo
              ? `${t("Asignar a")} ${conteo.total} ${conteo.total === 1 ? t("participante") : t("participantes")}`
              : t("Asignar a la selección")}
        </button>
        {conteo && (
          <span className="text-xs text-white/50">
            {conteo.conHotel} {t("de")} {conteo.total} {t("ya tienen hotel")}
          </span>
        )}
        {aviso && <span className="text-sm text-emerald-400">{aviso}</span>}
        {error && <span className="text-sm text-rose-400">{error}</span>}
      </div>
    </section>
  );
}
