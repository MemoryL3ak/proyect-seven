/**
 * Formato oficial de credencial de los Juegos Deportivos Escolares 2026
 * (Instituto Nacional de Deportes). Es la única fuente de colores, textos,
 * zonas y categorías: la plantilla HTML y el PDF la leen de acá para que las
 * dos salidas sean la misma tarjeta.
 *
 * Proporción: cada cara es 1240 × 1654 px (dos caras juntas, 2480 × 1654).
 * Las posiciones están como fracción del ancho y alto de UNA cara, copiadas
 * del HTML oficial (allí van en % y en `cqw`, que es 1/100 del ancho total,
 * o sea 1/50 del ancho de una cara).
 */

export const CREDENCIAL_COLORES = {
  morado: "#915090",
  oscuro: "#070d1d",
  naranjo: "#e16736",
  blanco: "#fffffd",
} as const;

export const CREDENCIAL_TEXTOS = {
  aviso:
    "Esta credencial es personal e intransferible. Debe ser portada en forma permanente y en un lugar visible, durante el evento deportivo. En caso de pérdida, favor hacerla llegar a los organizadores del evento.",
  lema: "AQUÍ EMPIEZA TODO",
} as const;

/** Rutas dentro de /public. Se sirven desde el dominio del front. */
export const CREDENCIAL_IMAGENES = {
  logoFrente: "/credencial/logo-frente.png",
  logoReverso: "/credencial/logo-reverso.png",
  redes: "/credencial/redes.png",
} as const;

/** Zonas de acceso, en el orden en que se imprimen. Coinciden con los códigos de Acreditaciones. */
export const ZONAS_CREDENCIAL: ReadonlyArray<{ codigo: string; nombre: string }> = [
  { codigo: "C", nombre: "CANCHA" },
  { codigo: "RD", nombre: "RECINTOS\nDEPORTIVOS" },
  { codigo: "TR", nombre: "TRANSPORTE" },
  { codigo: "H", nombre: "HOTEL" },
  { codigo: "R", nombre: "REUNIONES" },
  { codigo: "A", nombre: "ALIMENTACIÓN" },
];

/** Sólo las zonas concedidas, en el orden del catálogo; los códigos desconocidos no se imprimen. */
export function zonasConcedidas(accessTypes?: ReadonlyArray<string> | null): Array<{ codigo: string; nombre: string }> {
  const activas = new Set((accessTypes ?? []).map((c) => String(c).trim().toUpperCase()));
  return ZONAS_CREDENCIAL.filter((z) => activas.has(z.codigo));
}

export type CategoriaCredencial = {
  /** Letra grande del bloque superior de la franja ("I" de invitado). */
  letra: string;
  /** Texto vertical de la franja ("INVITADO"). */
  categoria: string;
  /** Color del bloque de la letra. */
  color: string;
};

/**
 * Categoría impresa según el tipo de participante. El formato oficial trae
 * la de INVITADO; las demás siguen la misma regla (letra inicial + nombre) y
 * el mismo morado mientras la organización no fije un color por categoría.
 */
export function categoriaCredencial(entrada: {
  userType?: string | null;
  roleLabel?: string | null;
  subjectType?: "PARTICIPANT" | "DRIVER" | string | null;
  /** Texto explícito: manda sobre todo lo demás. */
  categoria?: string | null;
  letra?: string | null;
}): CategoriaCredencial {
  const color = CREDENCIAL_COLORES.morado;
  if (entrada.categoria?.trim()) {
    const categoria = entrada.categoria.trim().toUpperCase();
    return { letra: (entrada.letra?.trim() || categoria.charAt(0)).toUpperCase(), categoria, color };
  }
  const tipo = String(entrada.userType ?? "").trim().toUpperCase();
  const rol = String(entrada.roleLabel ?? "").trim().toUpperCase();
  const esConductor = entrada.subjectType === "DRIVER" || tipo === "DRIVER" || rol === "CONDUCTOR";
  if (esConductor) return { letra: "C", categoria: "CONDUCTOR", color };
  if (tipo === "JEFE_MISION" || rol.includes("JEFE DE MISI")) return { letra: "JM", categoria: "JEFE DE MISIÓN", color };
  if (tipo === "TA" || tipo === "ATHLETE" || rol === "DEPORTISTA") return { letra: "D", categoria: "DEPORTISTA", color };
  if (tipo === "TF" || tipo === "COACH") return { letra: "OT", categoria: "OFICIAL TÉCNICO", color };
  if (tipo === "TM") return { letra: "P", categoria: "PRENSA", color };
  if (tipo === "COORDINADOR_SEDE") return { letra: "CS", categoria: "COORDINADOR DE SEDE", color };
  if (tipo.startsWith("COORDINADOR") || tipo === "COMITE_ORGANIZADOR" || tipo === "STAFF") {
    return { letra: "O", categoria: "ORGANIZACIÓN", color };
  }
  if (tipo === "PROVEEDORES" || tipo === "PROVIDER") return { letra: "PR", categoria: "PROVEEDOR", color };
  // VIP, T1, Familia Parapan, "Participante" genérico y todo lo demás.
  return { letra: "I", categoria: "INVITADO", color };
}

/**
 * Geometría de una cara como fracciones de su ancho (x, w) y de su alto
 * (y, h). Compartida por el HTML y el PDF.
 */
export const CARA = {
  ancho: 1240,
  alto: 1654,
  frente: {
    lateralAncho: 0.276,
    bloqueAlto: 0.179,
    letraFuente: 0.21, // 10.5 cqw = 21 % del ancho de la cara
    categoriaFuente: 0.108, // 5.4 cqw
    logos: { x: 0.415, y: 0.037, w: 0.32 },
    datos: { x: 0.34, xFin: 0.95, y: 0.25, yFin: 0.78 },
    fotoAncho: 0.38, // del ancho del bloque de datos, proporción 3:4
    nombreFuente: 0.034, // 1.7 cqw
    detalleFuente: 0.022, // 1.1 cqw
    zonas: { x: 0.516, yDesdeAbajo: 0.049, ancho: 0.097, gap: 0.03, codigoFuente: 0.048, nombreFuente: 0.012, nombreAlto: 0.04 },
  },
  reverso: {
    logos: { x: 0.645, y: 0.037, w: 0.32 },
    qr: { x: 0.131, y: 0.075, w: 0.3 },
    zonas: { x: 0.387, y: 0.472 },
    aviso: { x: 0.131, xFin: 0.867, y: 0.57, fuente: 0.032, padY: 0.026, padX: 0.02, borde: 0.003 },
    lema: { y: 0.809, fuente: 0.06, padY: 0.012 },
    redes: { x: 0.206, w: 0.612, y: 0.9 },
  },
} as const;
