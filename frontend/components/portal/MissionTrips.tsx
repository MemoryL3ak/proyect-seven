"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, CarIcon, ChevronDownIcon, UsersIcon, WhatsappIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, SURFACE, tripStatusMeta } from "@/lib/design";
import { buildDisciplineLabelMap, coincideDisciplinaPorNombre, deporteDeViaje, type DisciplineLike } from "@/lib/discipline-filters";
import { claveDiaEvento, etiquetaDiaEvento, fechaCortaEvento, fechaHoraEvento, horaEvento } from "@/lib/hora-evento";
import TripMap from "@/components/TripMap";
import TripLiveMap from "@/components/portal/TripLiveMap";
import { SegmentedFilter } from "@/components/ui/FilterControls";
import SelectorFiltro from "@/components/portal/SelectorFiltro";
import { mapaDeLugares, tocaLugar } from "@/lib/lugares";
import { openExternal, whatsappHref } from "@/lib/external-link";
import { legTypeShort } from "@/lib/tripTypes";
import { useI18n } from "@/lib/i18n";

/**
 * Viajes de la delegación para el Jefe de Misión. El traslado se asigna al
 * grupo (región + disciplina), así que la lista se ordena por hora, se puede
 * filtrar por disciplina y por estado, y cada tarjeta dice a qué disciplina
 * corresponde y a qué recinto va (nombre de la sede u hotel, no la dirección).
 */
export type MissionTrip = {
  id: string;
  status?: string | null;
  origin?: string | null;
  destination?: string | null;
  originVenueId?: string | null;
  originHotelId?: string | null;
  destinationVenueId?: string | null;
  destinationHotelId?: string | null;
  originFoodLocationId?: string | null;
  destinationFoodLocationId?: string | null;
  scheduledAt?: string | null;
  /** OUTBOUND (ida) o RETURN (regreso). */
  legType?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  discipline?: string | null;
  disciplineId?: string | null;
  delegationId?: string | null;
  /** Traslado de todas las regiones (inauguración, congresillo). */
  allDelegations?: boolean;
  requesterAthleteId?: string | null;
  athleteIds?: string[];
  athleteNames?: string[];
  passengerCount?: number | null;
  driverId?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
};

type NamedPlace = { id: string; name?: string | null; venueType?: string | null };
type DriverRow = { id: string; userId?: string | null; fullName?: string | null; phone?: string | null };

const ACTIVOS = new Set(["SCHEDULED", "REQUESTED", "EN_ROUTE", "PICKED_UP"]);
/**
 * Los que están andando ahora mismo. "Por realizar" los mete en el mismo saco
 * que los de pasado mañana, así que un bus en ruta quedaba perdido entre los
 * programados y sólo se distinguía por el color de su chip.
 */
const EN_CURSO = new Set(["EN_ROUTE", "PICKED_UP"]);
const norm = (v?: string | null) => String(v ?? "").trim().toUpperCase();

const chip = (bg: string, color: string): React.CSSProperties => ({
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  background: bg,
  color,
  whiteSpace: "nowrap",
});

export default function MissionTrips({
  trips,
  delegationId,
  delegationName,
  memberIds,
  disciplines,
  venues,
  accommodations,
  comedores = [],
  estado,
  onEstado,
  todas = false,
  delegacionFiltro = "",
  disciplinaExterna = "",
  hotelFiltro = "",
  sedeFiltro = "",
  titulo,
  nombreDelegacion,
  contactoChofer = false,
  nombreContacto = null,
}: {
  trips: MissionTrip[];
  delegationId?: string | null;
  /** Región del jefe: la lista está acotada a ella. */
  delegationName?: string;
  memberIds: string[];
  disciplines: DisciplineLike[];
  venues: NamedPlace[];
  accommodations: NamedPlace[];
  /** Comedores de Alimentación: el viaje puede apuntar a ellos por id. */
  comedores?: NamedPlace[];
  /** Filtro de estado mandado desde fuera (el banner "En curso ahora"). */
  estado?: string;
  onEstado?: (valor: string) => void;
  /**
   * Coordinador de Comité: la lista deja de acotarse a una delegación y pasa
   * a ser la del evento entero, filtrable desde fuera por región y deporte.
   */
  todas?: boolean;
  delegacionFiltro?: string;
  disciplinaExterna?: string;
  /**
   * Hotel y sede: dejan sólo los traslados que tocan ese lugar (salen de ahí
   * o llegan ahí). Son textos tal como los escribe la planilla, porque los
   * viajes importados no traen id de lugar; misma regla que el tracking del
   * panel (lib/lugares).
   */
  hotelFiltro?: string;
  sedeFiltro?: string;
  titulo?: string;
  /** Nombre de una región para mostrarlo en cada tarjeta cuando se ven todas. */
  nombreDelegacion?: (delegationId?: string | null) => string | null;
  /**
   * Contacto directo con el chofer del traslado. Es lo único que separa al
   * Coordinador de Transporte del Coordinador de Comité: los demás perfiles
   * del portal escriben al Coordinador General, no al conductor.
   */
  contactoChofer?: boolean;
  /** Quién escribe, para que el mensaje llegue firmado. */
  nombreContacto?: string | null;
}) {
  const { t } = useI18n();
  const [disciplinaFiltro, setDisciplinaFiltro] = useState("");
  /**
   * Día del traslado. Arranca en "todas" a propósito: el jefe abre Actividades
   * para ver qué tiene por delante, no sólo lo de hoy, y "Hoy" queda a un
   * toque. "SIN_FECHA" junta los traslados que todavía no tienen hora.
   */
  const [diaFiltro, setDiaFiltro] = useState("");
  const [estadoInterno, setEstadoInterno] = useState("ACTIVOS");
  // Si quien usa la lista lleva el filtro, manda él; si no, el de aquí.
  const estadoFiltro = estado ?? estadoInterno;
  const setEstadoFiltro = (valor: string) => {
    setEstadoInterno(valor);
    onEstado?.(valor);
  };
  const [abierto, setAbierto] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[] | null>(null);

  const labels = useMemo(() => buildDisciplineLabelMap(disciplines), [disciplines]);
  // "Comedor LRH (ex Gala)", "Sede Elías Figueroa", "Hotel Mahía".
  const lugar = useMemo(() => mapaDeLugares(venues, accommodations, comedores), [venues, accommodations, comedores]);
  // Nombre pelado del catálogo, para calzar lugares por texto en los filtros.
  const nombreCrudo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of venues) if (v.id && v.name) m.set(v.id, v.name);
    for (const h of accommodations) if (h.id && h.name) m.set(h.id, h.name);
    for (const c of comedores) if (c.id && c.name) m.set(c.id, c.name);
    return m;
  }, [venues, accommodations, comedores]);

  // Nombre del recinto cuando el viaje lo tiene asignado; si no, la dirección.
  const puntoOrigen = (tr: MissionTrip) =>
    lugar.get(tr.originVenueId ?? "") ??
    lugar.get(tr.originHotelId ?? "") ??
    lugar.get(tr.originFoodLocationId ?? "") ??
    tr.origin ??
    "—";
  const puntoDestino = (tr: MissionTrip) =>
    lugar.get(tr.destinationVenueId ?? "") ??
    lugar.get(tr.destinationHotelId ?? "") ??
    lugar.get(tr.destinationFoodLocationId ?? "") ??
    tr.destination ??
    "—";

  const disciplinaDe = (tr: MissionTrip) =>
    (tr.disciplineId ? labels.get(tr.disciplineId) : null) ?? tr.discipline ?? null;

  const miembros = useMemo(() => new Set(memberIds), [memberIds]);
  const propios = useMemo(() => {
    // Con `todas` la lista es la del evento; el recorte lo ponen los filtros
    // de región y deporte que llegan de fuera.
    const base = todas
      ? trips
      : trips.filter(
          (tr) =>
            tr.allDelegations ||
            (tr.delegationId && tr.delegationId === delegationId) ||
            (tr.requesterAthleteId && miembros.has(tr.requesterAthleteId)) ||
            (tr.athleteIds ?? []).some((id) => miembros.has(id)),
        );
    // Los de todas las regiones entran con cualquier región elegida.
    const porRegion = delegacionFiltro
      ? base.filter((tr) => tr.allDelegations || tr.delegationId === delegacionFiltro)
      : base;
    // Hotel y sede acotan antes que nada, igual que la región: así los chips
    // de disciplina de abajo cuentan sólo lo que toca ese lugar y no ofrecen
    // deportes que quedaron fuera del filtro.
    const nombreDe = (id: string) => nombreCrudo.get(id);
    const porHotel = hotelFiltro ? porRegion.filter((tr) => tocaLugar(tr, hotelFiltro, nombreDe)) : porRegion;
    return sedeFiltro ? porHotel.filter((tr) => tocaLugar(tr, sedeFiltro, nombreDe)) : porHotel;
  }, [trips, delegationId, miembros, todas, delegacionFiltro, hotelFiltro, sedeFiltro, nombreCrudo]);

  const hayEnCurso = useMemo(
    () => propios.some((tr) => EN_CURSO.has(norm(tr.status))),
    [propios],
  );

  /**
   * Deportes presentes, con cuántos traslados tiene cada uno. Se agrupa por
   * el deporte del catálogo y no por el texto de cada viaje: antes "Voleibol"
   * (texto de la planilla), "Vóleibol · Femenino" y "Vóleibol · Masculino"
   * (por id) salían como tres filtros distintos y el jefe de misión, que
   * quiere ver "los del vóleibol", tenía que adivinar cuál tocar.
   */
  const opcionesDeporte = useMemo(() => {
    const vistos = new Map<string, number>();
    for (const tr of propios) {
      const deporte = deporteDeViaje(tr, disciplines);
      if (!deporte) continue;
      vistos.set(deporte, (vistos.get(deporte) ?? 0) + 1);
    }
    return [...vistos.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([deporte, total]) => ({ value: deporte, label: `${deporte} · ${total}` }));
  }, [propios, disciplines]);

  /**
   * Los días que de verdad tienen traslados, con cuántos hay en cada uno. Un
   * calendario completo obligaría a tantear fechas vacías; así el filtro
   * muestra la jornada del evento tal como quedó armada.
   */
  const claveHoy = useMemo(() => claveDiaEvento(new Date()), []);

  const opcionesDia = useMemo(() => {
    const vistos = new Map<string, number>();
    for (const tr of propios) {
      const clave = claveDiaEvento(tr.scheduledAt) || "SIN_FECHA";
      vistos.set(clave, (vistos.get(clave) ?? 0) + 1);
    }
    return [...vistos.entries()]
      // Los que no tienen hora van al final, como en la lista.
      .sort((a, b) => (a[0] === "SIN_FECHA" ? 1 : b[0] === "SIN_FECHA" ? -1 : a[0].localeCompare(b[0])))
      .map(([clave, total]) => ({
        value: clave,
        // La cuenta va en la etiqueta: el selector muestra una sola línea y
        // saber cuántos traslados tiene el día es la mitad de la decisión.
        label: `${clave === "SIN_FECHA" ? t("Sin fecha") : t(etiquetaDiaEvento(clave))} · ${total}`,
      }));
  }, [propios, t]);

  const hayHoy = useMemo(
    () => opcionesDia.some((opcion) => opcion.value === claveHoy),
    [opcionesDia, claveHoy],
  );

  // El deporte elegido arriba por el coordinador. Los viajes de la planilla
  // traen la disciplina como texto y sin id, así que se calza por nombre.
  const disciplinaElegida = useMemo(
    () => (disciplinaExterna ? disciplines.find((d) => d.id === disciplinaExterna) ?? null : null),
    [disciplines, disciplinaExterna],
  );
  const esDelDeporteElegido = (tr: MissionTrip) => {
    if (!disciplinaExterna) return true;
    if (tr.disciplineId) return tr.disciplineId === disciplinaExterna;
    return disciplinaElegida ? coincideDisciplinaPorNombre(tr.discipline, disciplinaElegida) : false;
  };

  const visibles = useMemo(() => {
    const list = propios.filter((tr) => {
      if (!esDelDeporteElegido(tr)) return false;
      if (disciplinaFiltro && (deporteDeViaje(tr, disciplines) ?? "") !== disciplinaFiltro) return false;
      if (diaFiltro) {
        const suDia = claveDiaEvento(tr.scheduledAt) || "SIN_FECHA";
        if (suDia !== diaFiltro) return false;
      }
      const suEstado = norm(tr.status);
      if (estadoFiltro === "EN_CURSO") return EN_CURSO.has(suEstado);
      if (estadoFiltro === "ACTIVOS") return ACTIVOS.has(suEstado);
      if (estadoFiltro === "TERMINADOS") return !ACTIVOS.has(suEstado);
      return true;
    });
    // Del más temprano al más tarde, sin excepciones: el jefe lee la jornada
    // de corrido. Los viajes sin hora quedan al final.
    return list.sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return ta - tb;
    });
  }, [propios, disciplinaFiltro, disciplinaExterna, disciplinaElegida, diaFiltro, estadoFiltro, labels, disciplines]);

  // Si el día elegido deja de existir —cambió la región, el hotel o llegaron
  // otros viajes—, el filtro se suelta solo en vez de dejar la lista vacía
  // con un chip marcado que ya no está.
  useEffect(() => {
    if (diaFiltro && !opcionesDia.some((opcion) => opcion.value === diaFiltro)) {
      setDiaFiltro("");
    }
  }, [opcionesDia, diaFiltro]);

  // Los conductores se piden una sola vez, y sólo si hay viajes con chofer.
  useEffect(() => {
    if (drivers !== null) return;
    if (!propios.some((tr) => tr.driverId)) return;
    void apiFetch<DriverRow[]>("/drivers")
      .then((d) => setDrivers(Array.isArray(d) ? d : []))
      .catch(() => setDrivers([]));
  }, [propios, drivers]);

  const chofer = (tr: MissionTrip): DriverRow | null =>
    tr.driverId ? (drivers ?? []).find((d) => d.id === tr.driverId || d.userId === tr.driverId) ?? null : null;

  /**
   * WhatsApp al chofer con el traslado ya escrito en el mensaje: el
   * coordinador no tiene que explicarle de cuál de los traslados del día le
   * está hablando, que es donde se va el tiempo en una llamada.
   */
  const escribirAlChofer = (tr: MissionTrip, d: DriverRow) => {
    const nombre = (d.fullName ?? "").trim().split(" ")[0];
    const saludo = nombre ? `Hola ${nombre}` : "Hola";
    const firma = nombreContacto
      ? `, te escribe ${nombreContacto} de la coordinación de transporte`
      : ", te escribe la coordinación de transporte";
    const texto = `${saludo}${firma}. Es por el traslado de las ${horaEvento(tr.scheduledAt)} (${puntoOrigen(tr)} → ${puntoDestino(tr)}).`;
    openExternal(whatsappHref(String(d.phone), texto));
  };

  return (
    <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal, margin: 0 }}>
          {titulo ?? t("Viajes de mi delegación")}
        </p>
        <p style={{ fontSize: 11.5, color: SURFACE.textFaint, margin: "3px 0 0" }}>
          {delegationName ? `${delegationName} · ` : ""}
          {visibles.length} {visibles.length === 1 ? t("traslado") : t("traslados")}
          {estadoFiltro === "ACTIVOS" ? ` · ${t("por realizar")}` : ""}
          {estadoFiltro === "EN_CURSO" ? ` · ${t("en curso")}` : ""}
          {/* El día también en el resumen: con la lista desplazada, el chip
              marcado queda fuera de pantalla y el recuento parecía el total. */}
          {/* Sin la cuenta: el recuento ya está al principio de este mismo
              renglón, y repetirlo daba "207 traslados · … · mié 23 sept · 207". */}
          {diaFiltro
            ? ` · ${diaFiltro === "SIN_FECHA" ? t("Sin fecha") : t(etiquetaDiaEvento(diaFiltro))}`
            : ""}
        </p>
        <SegmentedFilter
          style={{ marginTop: 10 }}
          value={estadoFiltro}
          onChange={setEstadoFiltro}
          options={[
            // "En curso" sólo se ofrece cuando hay algo andando: un filtro
            // que siempre da vacío estorba más de lo que ayuda.
            ...(hayEnCurso ? [{ value: "EN_CURSO", label: t("En curso") }] : []),
            { value: "ACTIVOS", label: t("Por realizar") },
            { value: "TERMINADOS", label: t("Terminados") },
            { value: "TODOS", label: t("Todos") },
          ]}
        />
        {/* Día del traslado. Va antes que la disciplina porque la jornada es
            lo primero que se acota: "qué tengo mañana" se pregunta más que
            "qué tiene el vóleibol". Sólo aparece si hay más de un día: con
            uno solo, el filtro no filtra nada.

            En selector y no en fichas: el evento dura trece días, y trece
            fichas en una tira que se desplaza de lado obligan a arrastrar a
            ciegas para encontrar una fecha. El selector ocupa una fila
            cualquiera sea el largo del evento, dice qué día se está mirando
            y abre la lista completa —con buscador— en una hoja. "Hoy" queda
            al lado porque es el filtro que más se usa y así es un toque. */}
        {opcionesDia.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <SelectorFiltro
              rotulo={t("Día")}
              titulo={t("Día del traslado")}
              opciones={opcionesDia}
              etiquetaTodos={t("Todos los días")}
              valor={diaFiltro}
              onChange={setDiaFiltro}
            />
            {hayHoy && (
              <button
                type="button"
                onClick={() => setDiaFiltro(diaFiltro === claveHoy ? "" : claveHoy)}
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: diaFiltro === claveHoy ? "rgba(33,208,179,0.10)" : SURFACE.card,
                  border: `1px solid ${diaFiltro === claveHoy ? "rgba(33,208,179,0.45)" : SURFACE.border}`,
                  color: diaFiltro === claveHoy ? BRAND.tealInk : SURFACE.textMuted,
                }}
              >
                {t("Hoy")}
              </button>
            )}
          </div>
        )}
        {/* Deporte: selector de una línea, igual que el día. Las fichas
            desplazables cortaban los nombres en el teléfono y con un deporte
            por hoja de planilla se llenaban de variantes. Con `todas` manda
            el panel de filtros del Coordinador de Comité, y dos controles
            para lo mismo sólo confunden. Con un solo deporte no hay nada que
            filtrar. */}
        {opcionesDeporte.length > 1 && !todas && (
          <div style={{ marginTop: 8 }}>
            <SelectorFiltro
              rotulo={t("Deporte")}
              titulo={t("Deporte del traslado")}
              opciones={opcionesDeporte}
              etiquetaTodos={t("Todos los deportes")}
              valor={disciplinaFiltro}
              onChange={setDisciplinaFiltro}
            />
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {visibles.length === 0 && (
          <p style={{ fontSize: 13, color: SURFACE.textFaint, margin: 0, textAlign: "center", padding: 10 }}>
            {todas
              ? trips.length === 0
                ? t("El evento aún no tiene traslados cargados.")
                : t("Ningún traslado coincide con el filtro.")
              : propios.length === 0
              ? t("Tu delegación aún no tiene traslados asignados.")
              : t("Ningún traslado coincide con el filtro.")}
          </p>
        )}

        {visibles.slice(0, 50).map((tr) => {
          const st = tripStatusMeta(tr.status);
          const disciplina = disciplinaDe(tr);
          const abiertaEsta = abierto === tr.id;
          const pasajeros = (tr.athleteNames ?? []).filter(Boolean);
          const choferViaje = chofer(tr);
          const nombreChofer = choferViaje?.fullName ?? null;
          return (
            <div
              key={tr.id}
              onClick={() => setAbierto((prev) => (prev === tr.id ? null : tr.id))}
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                background: abiertaEsta ? SURFACE.card : SURFACE.bg,
                border: `1px solid ${abiertaEsta ? "rgba(33,208,179,0.35)" : SURFACE.borderMuted}`,
                transition: "all 150ms ease",
              }}
            >
              {/* Hora: es lo primero que busca un jefe de misión. */}
              <div style={{ width: 52, flexShrink: 0, textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: SURFACE.text, margin: 0, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                  {horaEvento(tr.scheduledAt)}
                </p>
                <p style={{ fontSize: 10.5, color: SURFACE.textFaint, margin: "2px 0 0", textTransform: "uppercase" }}>
                  {fechaCortaEvento(tr.scheduledAt)}
                </p>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={chip(st.bg, st.color)}>{t(st.label)}</span>
                  {/* Ida o regreso: la planilla trae cada tramo como viaje aparte. */}
                  {legTypeShort(tr.legType) && (
                    <span style={chip(SURFACE.borderMuted, SURFACE.textSecondary)}>{t(legTypeShort(tr.legType))}</span>
                  )}
                  {disciplina && <span style={chip("rgba(33,208,179,0.12)", BRAND.tealInk)}>{disciplina}</span>}
                  <span style={{ marginLeft: "auto", display: "flex", color: SURFACE.textFaint, transform: abiertaEsta ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}>
                    <ChevronDownIcon size={14} strokeWidth={2.2} />
                  </span>
                </div>

                <p style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, margin: 0, ...(abiertaEsta ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>
                  {puntoOrigen(tr)} → {puntoDestino(tr)}
                </p>
                {/* Viendo el evento entero, sin la región no se sabe de quién
                    es cada traslado. */}
                {todas && (tr.allDelegations || nombreDelegacion?.(tr.delegationId)) && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: BRAND.tealInk, margin: "2px 0 0" }}>
                    {tr.allDelegations ? t("Todas las regiones") : nombreDelegacion?.(tr.delegationId)}
                  </p>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  {(nombreChofer || tr.vehiclePlate) && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CarIcon size={11} /> {nombreChofer ?? t("Sin chofer")}
                      {tr.vehiclePlate ? ` · ${tr.vehiclePlate}` : ""}
                    </span>
                  )}
                  {/* El botón va junto al nombre del chofer y no dentro del
                      detalle: escribirle es lo primero que se hace cuando un
                      traslado se atrasa, y abrir la tarjeta para llegar a él
                      es un toque de más. */}
                  {contactoChofer && choferViaje?.phone && (
                    <button
                      type="button"
                      title={t("WhatsApp al conductor")}
                      onClick={(e) => {
                        e.stopPropagation();
                        escribirAlChofer(tr, choferViaje);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 9px",
                        borderRadius: 999,
                        border: `1px solid ${SURFACE.border}`,
                        background: SURFACE.card,
                        color: BRAND.tealInk,
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <WhatsappIcon size={11} /> {t("WhatsApp")}
                    </button>
                  )}
                  {(tr.passengerCount || pasajeros.length > 0) && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <UsersIcon size={11} /> {tr.passengerCount ?? pasajeros.length} {t("personas")}
                    </span>
                  )}
                </div>

                {abiertaEsta && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${SURFACE.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* En ruta: el bus en vivo. Antes o después: la ruta planificada. */}
                    {EN_CURSO.has(norm(tr.status)) ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <TripLiveMap
                          tripId={tr.id}
                          status={tr.status}
                          driverName={nombreChofer}
                          vehiclePlate={tr.vehiclePlate}
                          origin={tr.origin || puntoOrigen(tr)}
                          destination={tr.destination || puntoDestino(tr)}
                        />
                      </div>
                    ) : (
                      (tr.origin || tr.destination) && (
                        <div style={{ borderRadius: 10, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                          <TripMap origin={tr.origin} destination={tr.destination} height={170} />
                        </div>
                      )
                    )}
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: SURFACE.textFaint, margin: 0 }}>{t("ORIGEN")}</p>
                      <p style={{ fontSize: 12, color: SURFACE.textStrong, margin: "1px 0 0" }}>{tr.origin || puntoOrigen(tr)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", color: SURFACE.textFaint, margin: 0 }}>{t("DESTINO")}</p>
                      <p style={{ fontSize: 12, color: SURFACE.textStrong, margin: "1px 0 0" }}>{tr.destination || puntoDestino(tr)}</p>
                    </div>
                    {tr.completedAt && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: SURFACE.textMuted }}>{t("Completado")}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: BRAND.tealInk }}>
                          {fechaHoraEvento(tr.completedAt)}
                        </span>
                      </div>
                    )}
                    {pasajeros.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textFaint, margin: "0 0 4px" }}>
                          {t("Pasajeros")} · {pasajeros.length}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {pasajeros.map((n) => (
                            <span key={n} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "rgba(33,208,179,0.08)", color: BRAND.tealInk, border: "1px solid rgba(33,208,179,0.18)" }}>
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tr.notes && (
                      <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: 0, fontStyle: "italic" }}>{tr.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {visibles.length > 50 && (
          <p style={{ fontSize: 11, color: SURFACE.textFaint, textAlign: "center", margin: 0 }}>
            <CalendarIcon size={11} /> {t("Se muestran los 50 más próximos.")}
          </p>
        )}
      </div>
    </div>
  );
}
