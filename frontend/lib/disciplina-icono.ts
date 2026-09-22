/**
 * Qué icono le toca a cada deporte.
 *
 * El maestro de Disciplinas no guarda un icono: guarda un nombre escrito a
 * mano, y las nóminas escriben "Vóleibol", "Voleibol" y "VOLEIBOL" para la
 * misma cosa. Por eso el cruce es por palabra clave sobre el nombre
 * normalizado —sin acentos ni mayúsculas— y no por una tabla de nombres
 * exactos que se rompería con la primera tilde de más.
 *
 * En el maestro conviven con los deportes algunas entradas que no lo son
 * —CONGRESILLOS TECNICOS, JUECES, HOTELERIA EXTRA—: son bloques de la
 * operación que se cargaron como disciplina para poder asignarles viajes y
 * alojamiento. Llevan su propio icono en vez del de un deporte cualquiera.
 *
 * Lo que no calza cae en la medalla, que no afirma nada.
 */
import {
  BasketballIcon,
  BikeIcon,
  ChessKnightIcon,
  ClipboardIcon,
  DumbbellIcon,
  GavelIcon,
  GoalIcon,
  HammerThrowIcon,
  HandIcon,
  HotelIcon,
  MedalIcon,
  PoolIcon,
  ShirtIcon,
  SportShoeIcon,
  TableTennisIcon,
  VolleyballIcon,
  type IconComponent,
} from "@/components/ui/Icons";

/** Sin acentos, sin mayúsculas y sin puntuación: "Vóleibol" y "VOLEIBOL" igual. */
const clave = (valor: unknown) =>
  String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Se recorre en orden y gana la primera que aparece en el nombre, así que las
 * más específicas van antes: "lanzamiento de martillo" tiene que resolverse
 * antes de que "atletismo" o cualquier otra genérica lo atrape.
 */
const REGLAS: Array<{ palabras: string[]; icono: IconComponent }> = [
  { palabras: ["martillo"], icono: HammerThrowIcon },
  { palabras: ["ajedrez"], icono: ChessKnightIcon },
  { palabras: ["basquet", "basket", "baloncesto"], icono: BasketballIcon },
  { palabras: ["balonmano", "handball"], icono: HandIcon },
  { palabras: ["voleibol", "volley", "voley"], icono: VolleyballIcon },
  { palabras: ["tenis de mesa", "ping pong", "pingpong"], icono: TableTennisIcon },
  { palabras: ["futsal", "futbol", "football"], icono: GoalIcon },
  { palabras: ["ciclismo", "bicicleta", "bmx", "mtb"], icono: BikeIcon },
  { palabras: ["natacion", "acuatic", "waterpolo"], icono: PoolIcon },
  { palabras: ["judo", "karate", "taekwondo", "lucha"], icono: ShirtIcon },
  { palabras: ["atletismo", "atletico", "maraton", "corrida"], icono: SportShoeIcon },
  { palabras: ["halterofilia", "pesas", "levantamiento"], icono: DumbbellIcon },
  // Entradas de operación, no deportes.
  { palabras: ["juec", "arbitr"], icono: GavelIcon },
  { palabras: ["congresillo", "reunion", "tecnic"], icono: ClipboardIcon },
  { palabras: ["hoteleria", "hotel", "alojamiento"], icono: HotelIcon },
];

export function iconoDeDisciplina(nombre?: string | null): IconComponent {
  const texto = clave(nombre);
  if (!texto) return MedalIcon;
  for (const regla of REGLAS) {
    if (regla.palabras.some((palabra) => texto.includes(palabra))) return regla.icono;
  }
  return MedalIcon;
}
