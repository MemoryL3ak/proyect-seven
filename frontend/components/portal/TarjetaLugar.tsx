"use client";

import VenueMap from "@/components/VenueMap";
import { BedIcon, ChevronDownIcon, CoffeeIcon, PhoneIcon, PinIcon, WhatsappIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";
import { openExternal, whatsappHref } from "@/lib/external-link";
import { useI18n } from "@/lib/i18n";

/**
 * Tarjeta de un lugar del evento: sede, comedor u hotel.
 *
 * Antes las filas eran todas iguales —el mismo pin verde, el mismo texto— y
 * al abrir una caían cuatro bloques apilados: la foto, la dirección repetida
 * (ya estaba en la fila), la caja del coordinador y un mapa incrustado con
 * toda la interfaz de Google pegada al borde.
 *
 * Ahora la foto del recinto trabaja: va como miniatura en la fila, que es lo
 * que hace reconocible una lista de veintidós sedes de un vistazo. Al abrir,
 * foto y mapa comparten una franja, y debajo va un solo panel con lo que se
 * necesita —dónde queda y con quién hablar— en vez de tres cajas sueltas.
 */
export type CoordinadorLugar = {
  nombre?: string | null;
  telefono?: string | null;
  /** "Coordinador de sede", "Contacto del hotel"… */
  rotulo?: string;
};

/**
 * Una fila de contacto: quién es y los dos botones para hablarle.
 *
 * Está suelta porque el hotel trae varios —dos coordinadores y la gente de
 * apoyo por turno— mientras que la sede trae uno solo. Antes era un bloque
 * escrito una vez dentro de la ficha abierta.
 */
function FilaContacto({
  persona,
  rotuloPorDefecto,
  separador,
}: {
  persona: CoordinadorLugar;
  rotuloPorDefecto: string;
  separador: boolean;
}) {
  const { t } = useI18n();
  const telefono = persona.telefono ?? "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderTop: separador ? `1px solid ${SURFACE.borderMuted}` : "none",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          flexShrink: 0,
          background: "rgba(33,208,179,0.12)",
          color: BRAND.tealInk,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.02em",
        }}
      >
        {persona.nombre ? iniciales(persona.nombre) : <PhoneIcon size={14} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: SURFACE.textFaint,
          }}
        >
          {persona.rotulo ?? rotuloPorDefecto}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 700,
            color: SURFACE.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {persona.nombre || telefono}
        </span>
      </span>
      {telefono && (
        <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            title={t("Llamar")}
            aria-label={t("Llamar")}
            onClick={() => openExternal(`tel:${telefono}`)}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1px solid ${SURFACE.border}`,
              background: SURFACE.card,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: SURFACE.textSecondary,
            }}
          >
            <PhoneIcon size={14} />
          </button>
          <button
            type="button"
            title="WhatsApp"
            aria-label="WhatsApp"
            onClick={() => openExternal(whatsappHref(telefono))}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid rgba(33,208,179,0.35)",
              background: "rgba(33,208,179,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: BRAND.tealInk,
            }}
          >
            <WhatsappIcon size={15} />
          </button>
        </span>
      )}
    </div>
  );
}

/** `ancho` ocupa toda la fila y deja que el valor se reparta en varias líneas. */
export type DatoLugar = { etiqueta: string; valor: string; ancho?: boolean };

/** Iniciales para el círculo del coordinador: "Marta Valdenegro" → "MV". */
const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

function Marcador({ tipo, size = 18 }: { tipo: "sede" | "comedor" | "hotel"; size?: number }) {
  if (tipo === "hotel") return <BedIcon size={size} color={BRAND.teal} strokeWidth={2} />;
  if (tipo === "comedor") return <CoffeeIcon size={size} color={BRAND.teal} strokeWidth={2} />;
  return <PinIcon size={size} color={BRAND.teal} strokeWidth={2} />;
}

export default function TarjetaLugar({
  nombre,
  direccion,
  lugar,
  foto,
  tipo = "sede",
  coordinador,
  contactos = [],
  datos = [],
  etiquetas = [],
  abierta,
  onToggle,
}: {
  nombre: string;
  /** Calle y número. */
  direccion?: string | null;
  /** Comuna y región, o ciudad y país. */
  lugar?: string | null;
  foto?: string | null;
  tipo?: "sede" | "comedor" | "hotel";
  /** Sólo se pasa a quien corresponde verlo. */
  coordinador?: CoordinadorLugar | null;
  /**
   * Contactos adicionales, en orden. El hotel trae varios —coordinadores y
   * apoyos por turno—; la sede se sigue conformando con `coordinador`.
   */
  contactos?: CoordinadorLugar[];
  /** Pares sueltos: check-in, tipo de habitación, teléfono… */
  datos?: DatoLugar[];
  /** Fichas en la fila: las disciplinas que se presentan en la sede. */
  etiquetas?: string[];
  abierta: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const consulta = [direccion, lugar].filter(Boolean).join(", ");
  const personas = [...(coordinador ? [coordinador] : []), ...contactos].filter(
    (p) => p.nombre || p.telefono,
  );
  const hayCoordinador = personas.length > 0;
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(consulta)}&travelmode=driving`;

  return (
    <div
      style={{
        background: SURFACE.card,
        borderRadius: 16,
        border: `1px solid ${abierta ? "rgba(33,208,179,0.45)" : SURFACE.border}`,
        overflow: "hidden",
        transition: "border-color 150ms ease",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: 10,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* La foto identifica el recinto mucho antes que su nombre. Sin foto,
            un cuadro del color de la marca con el icono que le corresponde. */}
        {foto ? (
          <img
            src={foto}
            alt=""
            loading="lazy"
            style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: SURFACE.bg }}
          />
        ) : (
          <span
            style={{
              width: 54,
              height: 54,
              borderRadius: 12,
              flexShrink: 0,
              background: "rgba(33,208,179,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Marcador tipo={tipo} size={20} />
          </span>
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              fontSize: 14,
              fontWeight: 800,
              lineHeight: 1.25,
              color: SURFACE.text,
            }}
          >
            {nombre}
          </span>
          {(lugar || direccion) && (
            <span
              style={{
                display: "block",
                marginTop: 3,
                fontSize: 11.5,
                color: SURFACE.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {lugar || direccion}
            </span>
          )}

          {/* Qué se compite acá. Sin esto, una lista de veintidós recintos no
              dice nada: todos son "un gimnasio en Viña". */}
          {etiquetas.length > 0 && (
            <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
              {etiquetas.slice(0, 3).map((e) => (
                <span
                  key={e}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "rgba(33,208,179,0.10)",
                    color: BRAND.tealInk,
                    whiteSpace: "nowrap",
                  }}
                >
                  {e}
                </span>
              ))}
              {etiquetas.length > 3 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: SURFACE.textFaint, alignSelf: "center" }}>
                  +{etiquetas.length - 3}
                </span>
              )}
            </span>
          )}

          {/* Con quién hablar en el recinto, sin tener que abrir la ficha. Si
              hay más de uno se nombra al primero y se cuentan los demás: la
              fila no da para listar a cinco personas. */}
          {personas[0]?.nombre && (
            <span style={{ display: "block", marginTop: 4, fontSize: 11, color: SURFACE.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {personas[0].rotulo ?? t("Coordinador")}:{" "}
              <span style={{ color: SURFACE.textSecondary, fontWeight: 700 }}>{personas[0].nombre}</span>
              {personas.length > 1 && ` +${personas.length - 1}`}
            </span>
          )}
        </span>

        <ChevronDownIcon
          size={13}
          color={abierta ? BRAND.tealInk : SURFACE.textFaint}
          strokeWidth={2}
          style={{ transition: "transform .15s", transform: abierta ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }}
        />
      </button>

      {abierta && (
        <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Foto y mapa comparten franja: qué es y dónde queda, de una mirada. */}
          {(foto || consulta) && (
            <div style={{ display: "flex", gap: 8 }}>
              {foto && (
                <img
                  src={foto}
                  alt={nombre}
                  loading="lazy"
                  style={{ flex: 1, minWidth: 0, height: 112, borderRadius: 12, objectFit: "cover", background: SURFACE.bg }}
                />
              )}
              {consulta && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <VenueMap title={nombre} query={consulta} alto={112} />
                </div>
              )}
            </div>
          )}

          <div style={{ background: SURFACE.bg, borderRadius: 12, border: `1px solid ${SURFACE.borderMuted}` }}>
            {consulta && (
              <div style={{ display: "flex", gap: 9, padding: "10px 12px", alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, paddingTop: 1 }}>
                  <Marcador tipo={tipo} size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {direccion && (
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: SURFACE.text, lineHeight: 1.35 }}>
                      {direccion}
                    </span>
                  )}
                  {lugar && (
                    <span style={{ display: "block", fontSize: 11.5, color: SURFACE.textMuted, marginTop: 1 }}>{lugar}</span>
                  )}
                </span>
              </div>
            )}

            {personas.map((persona, indice) => (
              <FilaContacto
                key={`${persona.nombre ?? ""}-${persona.telefono ?? ""}-${indice}`}
                persona={persona}
                rotuloPorDefecto={t("Coordinador de sede")}
                separador={indice > 0 || Boolean(consulta)}
              />
            ))}

            {datos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  gap: "8px 12px",
                  padding: "10px 12px",
                  borderTop: consulta || hayCoordinador ? `1px solid ${SURFACE.borderMuted}` : "none",
                }}
              >
                {datos.map((d) => (
                  <span key={d.etiqueta} style={{ minWidth: 0, gridColumn: d.ancho ? "1 / -1" : undefined }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: SURFACE.textFaint,
                      }}
                    >
                      {d.etiqueta}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: SURFACE.text,
                        overflow: d.ancho ? undefined : "hidden",
                        textOverflow: d.ancho ? undefined : "ellipsis",
                        whiteSpace: d.ancho ? "normal" : "nowrap",
                        lineHeight: d.ancho ? 1.4 : undefined,
                      }}
                    >
                      {d.valor}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {consulta && (
            <button
              type="button"
              onClick={() => openExternal(comoLlegar)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                padding: "11px 12px",
                borderRadius: 12,
                border: "1px solid rgba(33,208,179,0.35)",
                background: "rgba(33,208,179,0.10)",
                color: BRAND.tealInk,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              {t("Cómo llegar")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
