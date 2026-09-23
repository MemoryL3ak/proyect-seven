"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/**
 * Distribución hotelera por delegación y disciplina.
 *
 * Es la planilla con la que se decide el alojamiento del evento: las regiones
 * en las filas, los deportes en las columnas y en cada cruce el hotel donde se
 * aloja esa selección. Hay dos vistas, damas y varones, porque los deportes
 * mixtos pueden repartir cada rama en hoteles distintos.
 *
 * Asignar aquí no mueve todavía a nadie: cuando la planilla está lista, el
 * botón de abajo la baja a la ficha de cada participante.
 */
type Rama = "DAMAS" | "VARONES";

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
type Hotel = { id: string; name?: string | null };
type Celda = {
  delegationId: string;
  disciplineId: string;
  branch: Rama;
  accommodationId: string | null;
};

const clave = (delegationId: string, disciplineId: string, branch: Rama) =>
  `${delegationId}|${disciplineId}|${branch}`;

/** "Atletismo" paralímpico se llama paraatletismo en la planilla del evento. */
const etiquetaDisciplina = (d: Disciplina) => {
  const nombre = (d.name ?? "").trim();
  return String(d.category ?? "").toUpperCase() === "PARALYMPIC" ? `Para ${nombre.toLowerCase()}` : nombre;
};

const sinTildes = (v: string) =>
  v.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * El orden de las columnas es el de la planilla con la que trabaja el equipo,
 * no el alfabético: así se lee igual que el papel que ya tienen.
 */
const ORDEN_PLANILLA = [
  "atletismo",
  "para atletismo",
  "futsal",
  "voleibol",
  "ciclismo",
  "judo",
  "natacion",
  "ajedrez",
  "balonmano",
  "basquetbol",
  "tenis de mesa",
];

const ordenDe = (d: Disciplina) => {
  const i = ORDEN_PLANILLA.indexOf(sinTildes(etiquetaDisciplina(d)));
  return i === -1 ? ORDEN_PLANILLA.length : i;
};

/**
 * Las regiones, de norte a sur y con el nombre corto: es como se listan en
 * Chile y como están en la planilla de papel. El nombre oficial
 * ("Región de Aysén del General Carlos Ibáñez del Campo") no cabe en una
 * tabla de once columnas y empuja el resto fuera de la pantalla.
 */
const REGIONES: { codigo: string; corto: string }[] = [
  { codigo: "CL-AP", corto: "Arica" },
  { codigo: "CL-TA", corto: "Tarapacá" },
  { codigo: "CL-AN", corto: "Antofagasta" },
  { codigo: "CL-AT", corto: "Atacama" },
  { codigo: "CL-CO", corto: "Coquimbo" },
  { codigo: "CL-VS", corto: "Valparaíso" },
  { codigo: "CL-RM", corto: "Metropolitana" },
  { codigo: "CL-LI", corto: "O'Higgins" },
  { codigo: "CL-ML", corto: "Maule" },
  { codigo: "CL-NB", corto: "Ñuble" },
  { codigo: "CL-BI", corto: "Biobío" },
  { codigo: "CL-AR", corto: "Araucanía" },
  { codigo: "CL-LR", corto: "Los Ríos" },
  { codigo: "CL-LL", corto: "Los Lagos" },
  { codigo: "CL-AI", corto: "Aysén" },
  { codigo: "CL-MA", corto: "Magallanes" },
];
const ORDEN_REGION = new Map(REGIONES.map((r, i) => [r.codigo, i]));
const CORTO_REGION = new Map(REGIONES.map((r) => [r.codigo, r.corto]));

const nombreCorto = (v: string) => v.replace(/^regi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, "").trim() || v;

export default function DistribucionHotelera() {
  const { t } = useI18n();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [rama, setRama] = useState<Rama>("DAMAS");
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [hoteles, setHoteles] = useState<Hotel[]>([]);
  const [guardadas, setGuardadas] = useState<Map<string, string | null>>(new Map());
  const [cambios, setCambios] = useState<Map<string, string | null>>(new Map());
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Catálogos: se piden una vez.
  useEffect(() => {
    void (async () => {
      try {
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
        if (Array.isArray(ev) && ev.length && !eventoId) setEventoId(ev[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("No se pudieron cargar los catálogos."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La planilla del evento elegido.
  useEffect(() => {
    if (!eventoId) return;
    setCargando(true);
    setCambios(new Map());
    void apiFetch<Celda[]>(`/delegation-hotels?eventId=${encodeURIComponent(eventoId)}`)
      .then((filas) => {
        const mapa = new Map<string, string | null>();
        for (const f of Array.isArray(filas) ? filas : []) {
          mapa.set(clave(f.delegationId, f.disciplineId, f.branch), f.accommodationId);
        }
        setGuardadas(mapa);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("No se pudo cargar la distribución.")))
      .finally(() => setCargando(false));
  }, [eventoId, t]);

  const filas = useMemo(
    () =>
      delegaciones
        .filter((d) => !eventoId || d.eventId === eventoId)
        .sort((a, b) => {
          const ia = ORDEN_REGION.get(a.countryCode ?? "") ?? 99;
          const ib = ORDEN_REGION.get(b.countryCode ?? "") ?? 99;
          return ia - ib || (a.name ?? "").localeCompare(b.name ?? "");
        }),
    [delegaciones, eventoId],
  );

  // Columnas de la rama: los deportes de ese género más los mixtos, que
  // aparecen en las dos planillas.
  const columnas = useMemo(() => {
    const generoRama = rama === "DAMAS" ? "FEMALE" : "MALE";
    return disciplinas
      .filter((d) => (!eventoId || d.eventId === eventoId) && !d.parentId)
      .filter((d) => {
        const g = String(d.gender ?? "").toUpperCase();
        return g === generoRama || g === "MIXED" || g === "";
      })
      .sort((a, b) => ordenDe(a) - ordenDe(b) || etiquetaDisciplina(a).localeCompare(etiquetaDisciplina(b)));
  }, [disciplinas, eventoId, rama]);

  const hotelesOrdenados = useMemo(
    () => [...hoteles].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [hoteles],
  );

  const valorDe = (delegationId: string, disciplineId: string) => {
    const k = clave(delegationId, disciplineId, rama);
    return (cambios.has(k) ? cambios.get(k) : guardadas.get(k)) ?? "";
  };

  const cambiar = (delegationId: string, disciplineId: string, accommodationId: string) => {
    const k = clave(delegationId, disciplineId, rama);
    const nuevo = accommodationId || null;
    setCambios((prev) => {
      const siguiente = new Map(prev);
      // Si vuelve a lo guardado, deja de contar como cambio.
      if ((guardadas.get(k) ?? null) === nuevo) siguiente.delete(k);
      else siguiente.set(k, nuevo);
      return siguiente;
    });
  };

  const guardar = async () => {
    if (!eventoId || cambios.size === 0) return;
    setGuardando(true);
    setAviso(null);
    setError(null);
    try {
      const cells: Celda[] = [...cambios.entries()].map(([k, accommodationId]) => {
        const [delegationId, disciplineId, branch] = k.split("|");
        return { delegationId, disciplineId, branch: branch as Rama, accommodationId };
      });
      const r = await apiFetch<{ guardadas: number; borradas: number }>("/delegation-hotels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: eventoId, cells }),
      });
      setGuardadas((prev) => {
        const siguiente = new Map(prev);
        for (const [k, v] of cambios.entries()) {
          if (v) siguiente.set(k, v);
          else siguiente.delete(k);
        }
        return siguiente;
      });
      setCambios(new Map());
      setAviso(`${t("Guardado")}: ${r.guardadas} ${t("asignadas")}, ${r.borradas} ${t("vaciadas")}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  };

  const aplicar = async () => {
    if (!eventoId) return;
    setAplicando(true);
    setAviso(null);
    setError(null);
    try {
      const r = await apiFetch<{ actualizados: number; creados: number; sinCelda: number }>(
        "/delegation-hotels/apply",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: eventoId }),
        },
      );
      setAviso(
        `${t("Aplicado")}: ${r.creados} ${t("con hotel nuevo")}, ${r.actualizados} ${t("actualizados")}` +
          (r.sinCelda > 0 ? `, ${r.sinCelda} ${t("sin celda en la planilla")}` : "") + ".",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo aplicar."));
    } finally {
      setAplicando(false);
    }
  };

  const nombreDelegacion = (d: Delegacion) =>
    CORTO_REGION.get(d.countryCode ?? "") ?? nombreCorto(d.name || d.countryCode || "—");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-white/60">
          {t("Evento")}
          <select className="input" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
            <option value="">{t("Selecciona un evento")}</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name ?? ev.id}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          {(["DAMAS", "VARONES"] as Rama[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn ${rama === r ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setRama(r)}
            >
              {r === "DAMAS" ? t("Damas") : t("Varones")}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {cambios.size > 0 && (
            <span className="text-xs text-amber-300">
              {cambios.size} {cambios.size === 1 ? t("cambio sin guardar") : t("cambios sin guardar")}
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || cambios.size === 0}
            onClick={() => void guardar()}
          >
            {guardando ? t("Guardando...") : t("Guardar cambios")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={aplicando || !eventoId}
            onClick={() => void aplicar()}
            title={t("Deja a cada participante en el hotel de su delegación y disciplina")}
          >
            {aplicando ? t("Aplicando...") : t("Aplicar a participantes")}
          </button>
        </div>
      </div>

      {aviso && <p className="text-sm text-emerald-400">{aviso}</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!eventoId ? (
        <p className="text-sm text-white/50">{t("Elige un evento para ver su distribución.")}</p>
      ) : cargando ? (
        <p className="text-sm text-white/50">{t("Cargando...")}</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-white/50">{t("Este evento todavía no tiene delegaciones.")}</p>
      ) : columnas.length === 0 ? (
        <p className="text-sm text-white/50">{t("Este evento todavía no tiene disciplinas cargadas.")}</p>
      ) : (
        <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch", border: `1px solid var(--border)`, borderRadius: 12 }}>
          <table className="table text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                {/* La columna de región y la fila de deportes se quedan fijas:
                    con once columnas se pierde la referencia al desplazarse. */}
                <th
                  style={{
                    position: "sticky", left: 0, top: 0, zIndex: 3,
                    background: "var(--surface)", textAlign: "left",
                    minWidth: 132, borderRight: `1px solid var(--border)`,
                  }}
                >
                  {t("Región")}
                </th>
                {columnas.map((d) => (
                  <th
                    key={d.id}
                    className="whitespace-nowrap uppercase"
                    style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface)" }}
                  >
                    {etiquetaDisciplina(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((del, i) => (
                <tr key={del.id} style={{ background: i % 2 ? "var(--bg)" : "transparent" }}>
                  <th
                    style={{
                      position: "sticky", left: 0, zIndex: 1,
                      background: i % 2 ? "var(--bg)" : "var(--surface)",
                      whiteSpace: "nowrap", textAlign: "left", fontWeight: 600,
                      minWidth: 132, borderRight: `1px solid var(--border)`,
                    }}
                  >
                    {nombreDelegacion(del)}
                  </th>
                  {columnas.map((disc) => {
                    const k = clave(del.id, disc.id, rama);
                    const tocada = cambios.has(k);
                    return (
                      <td key={disc.id} className="p-1">
                        <select
                          className="input w-full text-xs"
                          // "Bosques de Reñaca" y "Marina del Rey" tienen que
                          // leerse enteros: recortados se confunden con
                          // "Marina Dunas" y eso manda gente a otro hotel. La
                          // tabla se desplaza en horizontal antes que apretar.
                          style={{ minWidth: 186, ...(tocada ? { borderColor: "#fbbf24" } : {}) }}
                          value={valorDe(del.id, disc.id)}
                          onChange={(e) => cambiar(del.id, disc.id, e.target.value)}
                        >
                          <option value="">—</option>
                          {hotelesOrdenados.map((h) => (
                            <option key={h.id} value={h.id}>{h.name ?? h.id}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-white/40">
        {t("Los deportes mixtos aparecen en las dos planillas y pueden quedar en hoteles distintos según la rama. Guardar sólo escribe la planilla; los participantes se mueven con «Aplicar a participantes».")}
      </p>
    </section>
  );
}
