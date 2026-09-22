"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, MoonIcon, PinIcon, SunIcon, UtensilsIcon, UtensilsCrossedIcon } from "@/components/ui/Icons";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";

/**
 * El menú de un día, agrupado por comida.
 *
 * Cada fila de `food_menus` es una categoría —"Ensaladas", "Fondos",
 * "Postres", y en el desayuno "Carbohidratos", "Proteínas"…— así que un día
 * cargado son doce filas. Pintadas una debajo de otra con su insignia, el
 * desayuno parecía seis comidas distintas y había que leer seis veces la
 * palabra DESAYUNO para darse cuenta de que era una.
 *
 * Acá cada comida es una fila que se despliega: cerrada dice qué trae
 * ("Ensaladas · Fondos · Postres"), y abierta muestra los platos. Así el día
 * entero entra en tres renglones y el detalle está a un toque, en vez de una
 * pared de texto que hay que recorrer para llegar a la cena.
 */
export type MenuItem = {
  id: string;
  date: string;
  mealType: string;
  title: string;
  description?: string | null;
  dietaryType?: string | null;
  locationDetail?: string | null;
};

const ORDEN_COMIDA = ["DESAYUNO", "ALMUERZO", "COLACION", "CENA"];

/**
 * Las categorías salen en el orden en que se come, no alfabético: el postre
 * después del fondo. Lo que no esté en la lista va al final.
 */
const ORDEN_CATEGORIA = [
  "Carbohidratos",
  "Proteínas",
  "Líquidos",
  "Leche",
  "Yogurt",
  "Cereales",
  "Ensaladas",
  "Fondos",
  "Postres",
];

function estiloComida(tipo: string) {
  if (tipo === "DESAYUNO") {
    return { bg: STATE.warningSoft, color: STATE.warningText, border: STATE.warningBorder, icon: SunIcon, label: "Desayuno" };
  }
  if (tipo === "ALMUERZO") {
    return { bg: STATE.infoSoft, color: STATE.infoText, border: STATE.infoBorder, icon: UtensilsIcon, label: "Almuerzo" };
  }
  if (tipo === "CENA") {
    return { bg: "#E0E7FF", color: "#3730A3", border: "#C7D2FE", icon: MoonIcon, label: "Cena" };
  }
  return { bg: SURFACE.borderMuted, color: SURFACE.textSecondary, border: SURFACE.border, icon: UtensilsCrossedIcon, label: tipo };
}

export default function MenuDelDia({
  menus,
  titulo,
  fecha,
  vacio,
  atenuado = false,
}: {
  /** Ya filtrados por fecha y por el tipo de cliente de quien mira. */
  menus: MenuItem[];
  titulo: string;
  /** Encabezado de la tarjeta: "martes 22 de septiembre". */
  fecha: string;
  /** Qué decir cuando no hay nada cargado para ese día. */
  vacio: string;
  /** El de mañana se muestra más apagado que el de hoy. */
  atenuado?: boolean;
}) {
  const { t } = useI18n();
  /** Una comida abierta a la vez, como el listado de sedes. */
  const [abierta, setAbierta] = useState<string | null>(null);

  const porComida = useMemo(() => {
    const mapa = new Map<string, MenuItem[]>();
    for (const item of menus) {
      const lista = mapa.get(item.mealType) ?? [];
      lista.push(item);
      mapa.set(item.mealType, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => {
        const ia = ORDEN_CATEGORIA.indexOf(a.title);
        const ib = ORDEN_CATEGORIA.indexOf(b.title);
        if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return a.title.localeCompare(b.title);
      });
    }
    return [...mapa.entries()].sort(
      (a, b) => ORDEN_COMIDA.indexOf(a[0]) - ORDEN_COMIDA.indexOf(b[0]),
    );
  }, [menus]);

  return (
    <div
      style={{
        background: SURFACE.card,
        borderRadius: 16,
        border: `1px solid ${SURFACE.border}`,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
        opacity: atenuado ? 0.85 : 1,
      }}
    >
      <div
        style={{
          padding: "13px 16px",
          background: atenuado ? SURFACE.bg : "linear-gradient(135deg,rgba(33,208,179,0.08),rgba(33,208,179,0.02))",
          borderBottom: `1px solid ${SURFACE.border}`,
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{titulo}</p>
        <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: 0, textTransform: "capitalize" }}>{fecha}</p>
      </div>

      {porComida.length === 0 && (
        <div style={{ padding: 20, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: SURFACE.textFaint, margin: 0 }}>{vacio}</p>
        </div>
      )}

      {porComida.map(([comida, items], indice) => {
        const m = estiloComida(comida);
        // El lugar y el régimen son de la comida, no de cada categoría: se
        // dicen una vez arriba en lugar de repetirse en cada renglón.
        const lugar = items.find((item) => item.locationDetail)?.locationDetail;
        const regimenes = [
          ...new Set(
            items
              .map((item) => item.dietaryType)
              .filter((d): d is string => Boolean(d) && d !== "ESTANDAR"),
          ),
        ];
        const estaAbierta = abierta === comida;
        return (
          <div key={comida} style={{ borderTop: indice > 0 ? `1px solid ${SURFACE.borderMuted}` : "none" }}>
            <button
              type="button"
              onClick={() => setAbierta(estaAbierta ? null : comida)}
              aria-expanded={estaAbierta}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: estaAbierta ? SURFACE.bg : "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: m.bg,
                  border: `1px solid ${m.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: m.color,
                }}
              >
                <m.icon size={16} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: SURFACE.text }}>{t(m.label)}</span>
                  {regimenes.map((regimen) => (
                    <span
                      key={regimen}
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: STATE.successSoft,
                        color: STATE.successText,
                        border: `1px solid ${STATE.successBorder}`,
                      }}
                    >
                      {regimen}
                    </span>
                  ))}
                </span>
                {/* Cerrada, la fila dice qué trae la comida: sin esto habría
                    que abrir las tres para saber cuál tiene postre. */}
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: SURFACE.textMuted,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {items.map((item) => item.title).join(" · ")}
                </span>
                {lugar && (
                  <span style={{ display: "block", fontSize: 11, color: SURFACE.textFaint, marginTop: 2 }}>
                    <PinIcon size={10} className="inline mr-1" />
                    {lugar}
                  </span>
                )}
              </span>
              <ChevronDownIcon
                size={14}
                color={estaAbierta ? BRAND.tealInk : SURFACE.textFaint}
                strokeWidth={2}
                style={{
                  flexShrink: 0,
                  transition: "transform .15s",
                  transform: estaAbierta ? "rotate(180deg)" : "rotate(0)",
                }}
              />
            </button>

            {estaAbierta && (
              <div style={{ padding: "2px 16px 14px 60px", display: "flex", flexDirection: "column", gap: 9 }}>
                {items.map((item) => (
                  <div key={item.id}>
                    <p
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: BRAND.tealDark,
                        margin: 0,
                      }}
                    >
                      {item.title}
                    </p>
                    {item.description && (
                      <p style={{ fontSize: 12.5, color: SURFACE.text, margin: "1px 0 0", lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
