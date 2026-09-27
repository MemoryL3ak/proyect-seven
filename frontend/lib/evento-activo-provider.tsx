"use client";

/**
 * Evento activo compartido por todo el panel (27-09-2026). Un solo selector
 * en la barra superior; cada sección lee el evento de aquí en vez de tener
 * el suyo. La elección se recuerda en el navegador; si nadie eligió, se abre
 * el evento que está en curso según sus fechas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { hoyEnChile, ordenarEventos, resolverEventoActivo, type EventoResumen } from "@/lib/evento-activo";

const CLAVE = "seven.eventoActivo";
/** Lo dispara Registro de Eventos al crear, editar o borrar uno. */
const EVENTOS_CAMBIARON = "seven:eventos-cambiaron";

export type ValorEventoActivo = {
  /** Eventos ordenados para el selector: en curso, próximos, terminados. */
  eventos: EventoResumen[];
  /** "" mientras carga o si no hay eventos: en ese caso no se filtra nada. */
  eventoId: string;
  evento: EventoResumen | null;
  setEventoId: (id: string) => void;
  /** true cuando ya se sabe qué evento va (la lista llegó). */
  listo: boolean;
};

const SIN_PROVEEDOR: ValorEventoActivo = {
  eventos: [],
  eventoId: "",
  evento: null,
  setEventoId: () => {},
  listo: true,
};

const Contexto = createContext<ValorEventoActivo | null>(null);

const leerGuardado = (): string => {
  try {
    return window.localStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
};

/** Avisa al selector que la lista de eventos cambió (crear, editar, borrar). */
export function avisarEventosCambiaron() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTOS_CAMBIARON));
}

export function EventoActivoProvider({ children }: { children: React.ReactNode }) {
  const [eventos, setEventos] = useState<EventoResumen[]>([]);
  const [eventoId, setEventoIdEstado] = useState("");
  const [listo, setListo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch<EventoResumen[]>("/events");
      const lista = ordenarEventos(Array.isArray(data) ? data : [], hoyEnChile());
      setEventos(lista);
      // Lo guardado manda mientras exista; si no, el que está en curso.
      setEventoIdEstado((actual) => resolverEventoActivo(lista, actual || leerGuardado(), hoyEnChile()));
      setListo(true);
    } catch {
      // Sin la lista (red caída, sesión vencida) se queda lo que había.
      setListo(true);
    }
  }, []);

  useEffect(() => {
    // Lo guardado se aplica de inmediato para que las pantallas no muestren
    // todos los eventos mezclados mientras llega la lista.
    const guardado = leerGuardado();
    if (guardado) setEventoIdEstado(guardado);
    void cargar();
    const alCambiar = () => void cargar();
    const otraPestana = (e: StorageEvent) => {
      if (e.key === CLAVE && e.newValue) setEventoIdEstado(e.newValue);
    };
    window.addEventListener(EVENTOS_CAMBIARON, alCambiar);
    window.addEventListener("storage", otraPestana);
    return () => {
      window.removeEventListener(EVENTOS_CAMBIARON, alCambiar);
      window.removeEventListener("storage", otraPestana);
    };
  }, [cargar]);

  const setEventoId = useCallback((id: string) => {
    setEventoIdEstado(id);
    try {
      window.localStorage.setItem(CLAVE, id);
    } catch {
      // Sin almacenamiento (ventana privada): vale para esta sesión.
    }
  }, []);

  const valor = useMemo<ValorEventoActivo>(
    () => ({
      eventos,
      eventoId,
      evento: eventos.find((e) => e.id === eventoId) ?? null,
      setEventoId,
      listo,
    }),
    [eventos, eventoId, setEventoId, listo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Evento activo del panel. Fuera del panel (portales) no hay proveedor y
 * devuelve "sin evento": las pantallas no filtran.
 */
export function useEventoActivo(): ValorEventoActivo {
  return useContext(Contexto) ?? SIN_PROVEEDOR;
}
