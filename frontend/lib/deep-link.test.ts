import { describe, expect, it } from "vitest";
import {
  abrirDeepLink,
  deepLinkDeLaUrl,
  destinoDeNotificacion,
  esMismaPagina,
  guardarDeepLinkPendiente,
  tomarDeepLinkPendiente,
  urlDeDestino,
  VIGENCIA_PENDIENTE_MS,
} from "./deep-link";

const memoria = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe("destino de una notificación", () => {
  it("toma url interna, tripId y premiacionId del data; una url externa no vale", () => {
    expect(destinoDeNotificacion({ url: "/portal/conductor", tripId: "t1" })).toEqual({ url: "/portal/conductor", tripId: "t1", premiacionId: null });
    expect(destinoDeNotificacion({ url: "https://malo.com/x", tripId: "t1" }).url).toBeNull();
    expect(destinoDeNotificacion(null)).toEqual({ url: null, tripId: null, premiacionId: null });
  });

  it("misma página aunque cambie la query o la barra final", () => {
    expect(esMismaPagina("/portal/conductor?tripId=1", "/portal/conductor/")).toBe(true);
    expect(esMismaPagina("/portal/user", "/portal/conductor")).toBe(false);
    expect(esMismaPagina(null, "/portal/conductor")).toBe(false);
  });

  it("la url de navegación lleva el contexto como query", () => {
    expect(urlDeDestino({ url: "/portal/user", tripId: "t1", premiacionId: "p1" })).toBe("/portal/user?tripId=t1&premiacionId=p1");
    expect(urlDeDestino({ url: "/portal/user", tripId: null, premiacionId: null })).toBe("/portal/user");
    expect(deepLinkDeLaUrl("?tripId=t1")).toEqual({ url: null, tripId: "t1", premiacionId: null });
    expect(deepLinkDeLaUrl("")).toBeNull();
  });
});

describe("destino pendiente (sobrevive a /m/login → portal)", () => {
  const destino = { url: "/portal/conductor", tripId: "t1", premiacionId: null };

  it("se guarda y lo toma sólo la página a la que va, una sola vez", () => {
    const s = memoria();
    guardarDeepLinkPendiente(destino, s, 1000);
    expect(tomarDeepLinkPendiente("/m/login", s, 2000)).toBeNull();
    expect(tomarDeepLinkPendiente("/portal/conductor", s, 2000)).toEqual(destino);
    expect(tomarDeepLinkPendiente("/portal/conductor", s, 2000)).toBeNull();
  });

  it("uno vencido se descarta", () => {
    const s = memoria();
    guardarDeepLinkPendiente(destino, s, 1000);
    expect(tomarDeepLinkPendiente("/portal/conductor", s, 1000 + VIGENCIA_PENDIENTE_MS + 1)).toBeNull();
  });
});

describe("abrirDeepLink", () => {
  it("en otra página deja el destino pendiente y navega con el contexto", () => {
    const s = memoria();
    const idas: string[] = [];
    expect(abrirDeepLink({ url: "/portal/conductor", tripId: "t1", premiacionId: null }, (u) => idas.push(u), "/m/login", s)).toBe("navegado");
    expect(idas).toEqual(["/portal/conductor?tripId=t1"]);
    expect(tomarDeepLinkPendiente("/portal/conductor", s)).toMatchObject({ tripId: "t1" });
  });

  it("sin nada que abrir no hace nada", () => {
    expect(abrirDeepLink({ url: null, tripId: null, premiacionId: null }, () => undefined, "/portal/user", memoria())).toBe("nada");
    expect(abrirDeepLink({ url: "/portal/user", tripId: null, premiacionId: null }, () => undefined, "/portal/user", memoria())).toBe("nada");
  });
});
