/**
 * Copia de frontend/lib/paises.ts para el servidor, duplicada a propósito
 * (como la jornada y los permisos): la carga de viajes (planilla de buses)
 * de Rugby escribía "Canadá" o "Delegación Bélgica" y las delegaciones de
 * países sólo tienen el código ("CAN", "BEL"): 12 viajes quedaron sin
 * delegación (29-09-2026). Si se agrega un país o alias, en los dos lados.
 */
/**
 * Países: el catálogo del selector de la ficha y la lectura del país en las
 * cargas masivas (28-09-2026). La carga de AND de World Rugby traía
 * "Namibia", "Bélgica", "Rumania" y "Hong Kong China" y las 14 filas daban
 * "País/código inválido": sólo se reconocían unos 15 nombres, y el código
 * de 3 letras se revisaba sobre el texto tal cual.
 */
export type Pais = { value: string; label: string };

export const PAISES: Pais[] = [
  { value: "AFG", label: "Afganistán" }, { value: "ALB", label: "Albania" },
  { value: "DEU", label: "Alemania" }, { value: "AND", label: "Andorra" },
  { value: "AGO", label: "Angola" }, { value: "SAU", label: "Arabia Saudita" },
  { value: "DZA", label: "Argelia" }, { value: "ARG", label: "Argentina" },
  { value: "ARM", label: "Armenia" }, { value: "AUS", label: "Australia" },
  { value: "AUT", label: "Austria" }, { value: "AZE", label: "Azerbaiyán" },
  { value: "BHS", label: "Bahamas" }, { value: "BGD", label: "Bangladés" },
  { value: "BLR", label: "Bielorrusia" }, { value: "BEL", label: "Bélgica" },
  { value: "BLZ", label: "Belice" }, { value: "BEN", label: "Benín" },
  { value: "BOL", label: "Bolivia" }, { value: "BIH", label: "Bosnia y Herzegovina" },
  { value: "BWA", label: "Botsuana" }, { value: "BRA", label: "Brasil" },
  { value: "BRN", label: "Brunéi" }, { value: "BGR", label: "Bulgaria" },
  { value: "BFA", label: "Burkina Faso" }, { value: "BDI", label: "Burundi" },
  { value: "BTN", label: "Bután" }, { value: "CPV", label: "Cabo Verde" },
  { value: "KHM", label: "Camboya" }, { value: "CMR", label: "Camerún" },
  { value: "CAN", label: "Canadá" }, { value: "QAT", label: "Catar" },
  { value: "TCD", label: "Chad" }, { value: "CHL", label: "Chile" },
  { value: "CHN", label: "China" }, { value: "CYP", label: "Chipre" },
  { value: "COL", label: "Colombia" }, { value: "COM", label: "Comoras" },
  { value: "COD", label: "Congo (RDC)" }, { value: "COG", label: "Congo" },
  { value: "PRK", label: "Corea del Norte" }, { value: "KOR", label: "Corea del Sur" },
  { value: "CIV", label: "Costa de Marfil" }, { value: "CRI", label: "Costa Rica" },
  { value: "HRV", label: "Croacia" }, { value: "CUB", label: "Cuba" },
  { value: "DNK", label: "Dinamarca" }, { value: "DJI", label: "Djibouti" },
  { value: "ECU", label: "Ecuador" }, { value: "EGY", label: "Egipto" },
  { value: "SLV", label: "El Salvador" }, { value: "ARE", label: "Emiratos Árabes Unidos" },
  { value: "ERI", label: "Eritrea" }, { value: "SVK", label: "Eslovaquia" },
  { value: "SVN", label: "Eslovenia" }, { value: "ESP", label: "España" },
  { value: "USA", label: "Estados Unidos" }, { value: "EST", label: "Estonia" },
  { value: "ETH", label: "Etiopía" }, { value: "FJI", label: "Fiyi" },
  { value: "PHL", label: "Filipinas" }, { value: "FIN", label: "Finlandia" },
  { value: "FRA", label: "Francia" }, { value: "GAB", label: "Gabón" },
  { value: "GMB", label: "Gambia" }, { value: "GEO", label: "Georgia" },
  { value: "GHA", label: "Ghana" }, { value: "GRC", label: "Grecia" },
  { value: "GTM", label: "Guatemala" }, { value: "GIN", label: "Guinea" },
  { value: "GNB", label: "Guinea-Bisáu" }, { value: "GNQ", label: "Guinea Ecuatorial" },
  { value: "GUY", label: "Guyana" }, { value: "HTI", label: "Haití" },
  { value: "HND", label: "Honduras" }, { value: "HUN", label: "Hungría" },
  { value: "IND", label: "India" }, { value: "IDN", label: "Indonesia" },
  { value: "IRQ", label: "Irak" }, { value: "IRN", label: "Irán" },
  { value: "IRL", label: "Irlanda" }, { value: "ISL", label: "Islandia" },
  { value: "ISR", label: "Israel" }, { value: "ITA", label: "Italia" },
  { value: "JAM", label: "Jamaica" }, { value: "JPN", label: "Japón" },
  { value: "JOR", label: "Jordania" }, { value: "KAZ", label: "Kazajistán" },
  { value: "KEN", label: "Kenia" }, { value: "KGZ", label: "Kirguistán" },
  { value: "KWT", label: "Kuwait" }, { value: "LAO", label: "Laos" },
  { value: "LSO", label: "Lesoto" }, { value: "LVA", label: "Letonia" },
  { value: "LBN", label: "Líbano" }, { value: "LBR", label: "Liberia" },
  { value: "LBY", label: "Libia" }, { value: "LIE", label: "Liechtenstein" },
  { value: "LTU", label: "Lituania" }, { value: "LUX", label: "Luxemburgo" },
  { value: "MKD", label: "Macedonia del Norte" }, { value: "MDG", label: "Madagascar" },
  { value: "MYS", label: "Malasia" }, { value: "MWI", label: "Malaui" },
  { value: "MDV", label: "Maldivas" }, { value: "MLI", label: "Malí" },
  { value: "MLT", label: "Malta" }, { value: "MAR", label: "Marruecos" },
  { value: "MRT", label: "Mauritania" }, { value: "MUS", label: "Mauricio" },
  { value: "MEX", label: "México" }, { value: "MDA", label: "Moldavia" },
  { value: "MCO", label: "Mónaco" }, { value: "MNG", label: "Mongolia" },
  { value: "MNE", label: "Montenegro" }, { value: "MOZ", label: "Mozambique" },
  { value: "MMR", label: "Myanmar" }, { value: "NAM", label: "Namibia" },
  { value: "NPL", label: "Nepal" }, { value: "NIC", label: "Nicaragua" },
  { value: "NER", label: "Níger" }, { value: "NGA", label: "Nigeria" },
  { value: "NOR", label: "Noruega" }, { value: "NZL", label: "Nueva Zelanda" },
  { value: "OMN", label: "Omán" }, { value: "NLD", label: "Países Bajos" },
  { value: "PAK", label: "Pakistán" }, { value: "PAN", label: "Panamá" },
  { value: "PNG", label: "Papúa Nueva Guinea" }, { value: "PRY", label: "Paraguay" },
  { value: "PER", label: "Perú" }, { value: "POL", label: "Polonia" },
  { value: "PRT", label: "Portugal" }, { value: "GBR", label: "Reino Unido" },
  { value: "CAF", label: "República Centroafricana" }, { value: "CZE", label: "República Checa" },
  { value: "DOM", label: "República Dominicana" }, { value: "RWA", label: "Ruanda" },
  { value: "ROU", label: "Rumania" }, { value: "RUS", label: "Rusia" },
  { value: "SEN", label: "Senegal" }, { value: "SRB", label: "Serbia" },
  { value: "SLE", label: "Sierra Leona" }, { value: "SOM", label: "Somalia" },
  { value: "LKA", label: "Sri Lanka" }, { value: "SWZ", label: "Suazilandia" },
  { value: "ZAF", label: "Sudáfrica" }, { value: "SDN", label: "Sudán" },
  { value: "SSD", label: "Sudán del Sur" }, { value: "SWE", label: "Suecia" },
  { value: "CHE", label: "Suiza" }, { value: "SUR", label: "Surinam" },
  { value: "THA", label: "Tailandia" }, { value: "TZA", label: "Tanzania" },
  { value: "TJK", label: "Tayikistán" }, { value: "TLS", label: "Timor Oriental" },
  { value: "TGO", label: "Togo" }, { value: "TTO", label: "Trinidad y Tobago" },
  { value: "TUN", label: "Túnez" }, { value: "TKM", label: "Turkmenistán" },
  { value: "TUR", label: "Turquía" }, { value: "UGA", label: "Uganda" },
  { value: "UKR", label: "Ucrania" }, { value: "URY", label: "Uruguay" },
  { value: "UZB", label: "Uzbekistán" }, { value: "VEN", label: "Venezuela" },
  { value: "VNM", label: "Vietnam" }, { value: "YEM", label: "Yemen" },
  { value: "ZMB", label: "Zambia" }, { value: "ZWE", label: "Zimbabue" },
  // Faltaban para World Rugby U20 (28-09-2026): "Hong Kong China" no se
  // podía elegir en la ficha ni cargar en AND.
  { value: "HKG", label: "Hong Kong" }, { value: "WSM", label: "Samoa" },
  { value: "TON", label: "Tonga" }, { value: "SGP", label: "Singapur" },
  { value: "TWN", label: "Taiwán" },
].sort((a, b) => a.label.localeCompare(b.label, "es"));

/** Sin tildes, mayúsculas ni signos: "Hong Kong, China" = "hong kong china". */
const plano = (texto: unknown) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Nombres en inglés y formas comunes que no son la etiqueta del catálogo. */
const ALIAS: Record<string, string> = {
  "hong kong china": "HKG", "hong kong sar": "HKG", "hongkong": "HKG",
  "belgium": "BEL", "romania": "ROU", "germany": "DEU", "spain": "ESP", "france": "FRA",
  "italy": "ITA", "japan": "JPN", "netherlands": "NLD", "holanda": "NLD",
  "england": "GBR", "inglaterra": "GBR", "scotland": "GBR", "escocia": "GBR",
  "wales": "GBR", "gales": "GBR", "united kingdom": "GBR", "great britain": "GBR", "gran bretana": "GBR",
  "ireland": "IRL", "south africa": "ZAF", "new zealand": "NZL", "fiji": "FJI",
  "united states": "USA", "united states of america": "USA", "estados unidos de america": "USA",
  "ee uu": "USA", "eeuu": "USA", "eua": "USA", "brazil": "BRA", "mexico": "MEX", "peru": "PER",
  "canada": "CAN", "switzerland": "CHE", "sweden": "SWE", "norway": "NOR", "denmark": "DNK",
  "poland": "POL", "czech republic": "CZE", "czechia": "CZE", "chequia": "CZE",
  "south korea": "KOR", "korea": "KOR", "corea": "KOR", "russia": "RUS", "kenya": "KEN",
  "zimbabwe": "ZWE", "uganda": "UGA", "morocco": "MAR", "tunisia": "TUN", "georgia": "GEO",
  "samoa": "WSM", "tonga": "TON", "singapore": "SGP", "taiwan": "TWN", "chinese taipei": "TWN",
  "portugal": "PRT", "uruguay": "URY", "argentina": "ARG", "chile": "CHL", "paraguay": "PRY",
  "colombia": "COL", "australia": "AUS", "namibia": "NAM", "belgica": "BEL", "rumania": "ROU",
};

const POR_ETIQUETA = new Map(PAISES.map((p) => [plano(p.label), p.value]));
const CODIGOS = new Set(PAISES.map((p) => p.value));

/** Celda sin país: vacía o "Por informar", "Sin país", "-", "N/A". */
export function paisPorInformar(texto: unknown): boolean {
  const v = plano(texto);
  return !v || ["por informar", "sin pais", "sin informar", "no informado", "pendiente", "n a", "na", "tbc", "tbd"].includes(v);
}

/**
 * Código de 3 letras de un país escrito en la planilla: el código ("NAM",
 * "nam"), su nombre en español o inglés, con o sin tildes ("Bélgica",
 * "Belgium", "Rumanía") o formas como "Hong Kong China". "" si no se
 * reconoce o no hay país.
 */
export function codigoDePais(texto: unknown): string {
  const crudo = String(texto ?? "").trim();
  if (paisPorInformar(crudo)) return "";
  const mayus = crudo.toUpperCase();
  if (CODIGOS.has(mayus)) return mayus;
  const v = plano(crudo);
  const porNombre = POR_ETIQUETA.get(v) ?? ALIAS[v];
  if (porNombre) return porNombre;
  // Un código de 3 letras fuera del catálogo se acepta como antes.
  return /^[A-Z]{3}$/.test(mayus) ? mayus : "";
}

/** Nombre del país para mostrar ("NAM" → "Namibia"). */
export const nombreDePais = (codigo?: string | null) =>
  PAISES.find((p) => p.value === String(codigo ?? "").toUpperCase())?.label ?? (codigo || "");
