"use client";

// Kit de iconos del panel. Dos fuentes con la MISMA firma y el mismo trazo:
//  - los SVG dibujados a mano de más abajo (los 19 originales), y
//  - los respaldados por lucide-react al final del archivo.
// Hasta sep-2026 el kit no admitía librerías externas y tenía 19 iconos; las
// pantallas necesitaban cientos, y lo que llenó el hueco fueron emojis y
// dingbats (477 y 376 en 69 archivos). lucide-react ya estaba instalado, sin
// usar, y habla la misma gramática (cuadrícula de 24, trazo redondeado), así
// que se adopta como fuente para todo icono nuevo. Fuera de este archivo no
// se importa lucide-react directamente: todo pasa por acá para que tamaño,
// trazo y color se ajusten en un solo lugar.
// All icons accept className and size, default stroke 1.8.
import type { CSSProperties } from "react";
import {
  Accessibility,
  Activity,
  ArrowLeft,
  Ban,
  ChevronDown,
  CircleAlert,
  Coffee,
  Eye,
  Folder,
  Headphones,
  Heart,
  House,
  List,
  LoaderCircle,
  LogOut,
  Maximize2,
  Percent,
  Trash2,
  Wrench,
  Ambulance,
  Anchor,
  Bell,
  Building2,
  Camera,
  Compass,
  Dumbbell,
  Fingerprint,
  Flame,
  HardHat,
  Image as ImageGlyph,
  Landmark,
  LifeBuoy,
  Lock,
  MessageCircle,
  Monitor,
  Moon,
  Phone,
  Save,
  Siren,
  Smartphone,
  Stethoscope,
  Sun,
  Target,
  UtensilsCrossed,
  Zap,
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BedDouble,
  BookOpen,
  Bot,
  Briefcase,
  Bus,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  FishOff,
  Globe,
  Handshake,
  HeartPulse,
  Hotel,
  IdCard,
  KeyRound,
  LayoutGrid,
  Leaf,
  Mail,
  MapPinned,
  Medal,
  MilkOff,
  Pencil,
  PenLine,
  Plane,
  Printer,
  QrCode,
  Satellite,
  Shield,
  Star,
  Syringe,
  TrendingUp,
  Undo2,
  UserRound,
  Utensils,
  Vegan,
  WheatOff,
  X,
} from "lucide-react";

export type IconProps = {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
  /** Relleno; por defecto ninguno (iconos de trazo). Útil para una estrella llena. */
  fill?: string;
  /** Estilos inline: el panel y los portales posicionan iconos así (margen, alineación). */
  style?: CSSProperties;
};

/**
 * Para catálogos que guardan el icono y lo pintan en varios tamaños: se guarda
 * la referencia al componente (`icon: MedalIcon`) y cada sitio elige el suyo
 * (`<cfg.icon size={10} />`). Si el tamaño es fijo, alcanza con un elemento.
 */
export type IconComponent = (p: IconProps) => JSX.Element;

const sw = (n?: number) => n ?? 1.8;

function svg(
  children: React.ReactNode,
  { size = 20, className, color = "currentColor", strokeWidth, fill = "none", style }: IconProps,
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      style={style}
      stroke={color}
      strokeWidth={sw(strokeWidth)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const UsersIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
    p,
  );

export const PinIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>,
    p,
  );

export const RouteIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12" />
    </>,
    p,
  );

export const PackageIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>,
    p,
  );

export const ClipboardIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>,
    p,
  );

export const DollarIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>,
    p,
  );

export const TicketIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M3 7v2a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </>,
    p,
  );

export const TruckIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>,
    p,
  );

export const UploadIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>,
    p,
  );

export const CalendarIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>,
    p,
  );

export const CheckIcon = (p: IconProps) =>
  svg(<polyline points="20 6 9 17 4 12" />, p);

export const PlusIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>,
    p,
  );

export const SettingsIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
    p,
  );

export const FilterIcon = (p: IconProps) =>
  svg(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />, p);

export const SparkleIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    </>,
    p,
  );

export const AlertIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>,
    p,
  );

export const SearchIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>,
    p,
  );

export const RefreshIcon = (p: IconProps) =>
  svg(
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>,
    p,
  );

export const TrophyIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="6" y1="21" x2="18" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M8 17h8" />
      <path d="M17 5h3a2 2 0 0 1 2 2 4 4 0 0 1-4 4h-1" />
      <path d="M7 5H4a2 2 0 0 0-2 2 4 4 0 0 0 4 4h1" />
      <path d="M17 3v8a5 5 0 0 1-10 0V3z" />
    </>,
    p,
  );

// ── Respaldados por lucide-react ────────────────────────────────────────────
// Todos los glifos de lucide comparten tipo, así que `typeof LayoutGrid` sirve
// para cualquiera. La fábrica aplica los mismos defaults que `svg()` de arriba
// (20px, currentColor, trazo 1.8) para que un consumidor no note la diferencia.
const fromLucide =
  (Glyph: typeof LayoutGrid) =>
  ({ size = 20, className, color = "currentColor", strokeWidth, fill, style }: IconProps) => (
    <Glyph size={size} className={className} color={color} strokeWidth={sw(strokeWidth)} fill={fill ?? "none"} style={style} />
  );

/** Vista "todos": cuadrícula. */
export const LayoutGridIcon = fromLucide(LayoutGrid);
/** Cliente prioritario (VIP / T1). */
export const CrownIcon = fromLucide(Crown);
/** Planilla diaria (importación Excel). */
export const FileSpreadsheetIcon = fromLucide(FileSpreadsheet);
/** Carga manual. */
export const PenLineIcon = fromLucide(PenLine);

// Acciones y navegación: cerrar, anterior/siguiente, estrella, descargar,
// deshacer, editar, imprimir. Reemplazan los dingbats que se usaban como texto.
export const XIcon = fromLucide(X);
export const ChevronLeftIcon = fromLucide(ChevronLeft);
export const ChevronRightIcon = fromLucide(ChevronRight);
/** Conector origen → destino en rutas; no para texto corrido. */
export const ArrowRightIcon = fromLucide(ArrowRight);
export const BookOpenIcon = fromLucide(BookOpen);
export const SatelliteIcon = fromLucide(Satellite);
export const PlaneIcon = fromLucide(Plane);

// Portales, tutoriales y catálogos (bloques 2 y 3).
export const BellIcon = fromLucide(Bell);
export const MessageIcon = fromLucide(MessageCircle);
export const PhoneIcon = fromLucide(Phone);
export const CameraIcon = fromLucide(Camera);
export const ImageIcon = fromLucide(ImageGlyph);
export const CompassIcon = fromLucide(Compass);
export const SunIcon = fromLucide(Sun);
export const MoonIcon = fromLucide(Moon);
export const UtensilsCrossedIcon = fromLucide(UtensilsCrossed);
export const DumbbellIcon = fromLucide(Dumbbell);
export const StethoscopeIcon = fromLucide(Stethoscope);
export const BuildingIcon = fromLucide(Building2);
export const LandmarkIcon = fromLucide(Landmark);
export const LockIcon = fromLucide(Lock);
export const MonitorIcon = fromLucide(Monitor);
export const SmartphoneIcon = fromLucide(Smartphone);
export const LifeBuoyIcon = fromLucide(LifeBuoy);
export const HardHatIcon = fromLucide(HardHat);
export const ZapIcon = fromLucide(Zap);
export const TargetIcon = fromLucide(Target);
export const SaveIcon = fromLucide(Save);
// Reemplazo de <svg> pegados a mano (feather / heroicons) en pantallas.
export const ChevronDownIcon = fromLucide(ChevronDown);
export const ArrowLeftIcon = fromLucide(ArrowLeft);
export const TrashIcon = fromLucide(Trash2);
export const CoffeeIcon = fromLucide(Coffee);
export const LogOutIcon = fromLucide(LogOut);
export const EyeIcon = fromLucide(Eye);
export const PercentIcon = fromLucide(Percent);
export const WrenchIcon = fromLucide(Wrench);
export const HeadphonesIcon = fromLucide(Headphones);
export const HeartIcon = fromLucide(Heart);
export const BanIcon = fromLucide(Ban);
export const LoaderIcon = fromLucide(LoaderCircle);
export const HomeIcon = fromLucide(House);
export const ActivityIcon = fromLucide(Activity);
export const MaximizeIcon = fromLucide(Maximize2);
export const FolderIcon = fromLucide(Folder);
export const ListIcon = fromLucide(List);
export const AlertCircleIcon = fromLucide(CircleAlert);
// Números de emergencia.
export const AmbulanceIcon = fromLucide(Ambulance);
export const FlameIcon = fromLucide(Flame);
export const SirenIcon = fromLucide(Siren);
export const FingerprintIcon = fromLucide(Fingerprint);
export const AnchorIcon = fromLucide(Anchor);
export const StarIcon = fromLucide(Star);
export const DownloadIcon = fromLucide(Download);
export const UndoIcon = fromLucide(Undo2);
export const PencilIcon = fromLucide(Pencil);
export const PrinterIcon = fromLucide(Printer);
export const CheckCircleIcon = fromLucide(CheckCircle2);
export const ClockIcon = fromLucide(Clock);
export const MailIcon = fromLucide(Mail);
export const HelpCircleIcon = fromLucide(CircleHelp);
export const BadgeCheckIcon = fromLucide(BadgeCheck);
export const BotIcon = fromLucide(Bot);

// Dominio (módulos, catálogos, tarjetas).
export const BarChartIcon = fromLucide(BarChart3);
export const TrendingUpIcon = fromLucide(TrendingUp);
export const UserIcon = fromLucide(UserRound);
export const ShieldIcon = fromLucide(Shield);
export const BusIcon = fromLucide(Bus);
export const CarIcon = fromLucide(Car);
export const QrCodeIcon = fromLucide(QrCode);
export const BanknoteIcon = fromLucide(Banknote);
export const HotelIcon = fromLucide(Hotel);
export const BedIcon = fromLucide(BedDouble);
export const KeyIcon = fromLucide(KeyRound);
export const UtensilsIcon = fromLucide(Utensils);
export const BriefcaseIcon = fromLucide(Briefcase);
export const HeartPulseIcon = fromLucide(HeartPulse);
export const HandshakeIcon = fromLucide(Handshake);
export const MedalIcon = fromLucide(Medal);
export const MapPinnedIcon = fromLucide(MapPinned);
export const CalendarDaysIcon = fromLucide(CalendarDays);
export const IdCardIcon = fromLucide(IdCard);
export const FileTextIcon = fromLucide(FileText);
export const GlobeIcon = fromLucide(Globe);
export const AccessibilityIcon = fromLucide(Accessibility);
export const ArrowLeftRightIcon = fromLucide(ArrowLeftRight);

// Tipos de dieta (alimentación).
export const LeafIcon = fromLucide(Leaf);
export const VeganIcon = fromLucide(Vegan);
export const WheatOffIcon = fromLucide(WheatOff);
export const MilkOffIcon = fromLucide(MilkOff);
export const FishOffIcon = fromLucide(FishOff);
export const SyringeIcon = fromLucide(Syringe);

// ── Registro por nombre ──────────────────────────────────────────────────────
// Para catálogos que viven en archivos .ts sin JSX (lib/modules.ts, tipos de
// dieta): guardan un `IconName` y la pantalla lo resuelve con <Icon name=…/>.
// Antes esos catálogos guardaban un emoji como string y lo pintaban tal cual.
export const ICONS = {
  "bar-chart": BarChartIcon,
  "trending-up": TrendingUpIcon,
  calendar: CalendarIcon,
  "calendar-days": CalendarDaysIcon,
  user: UserIcon,
  users: UsersIcon,
  shield: ShieldIcon,
  "check-circle": CheckCircleIcon,
  pin: PinIcon,
  "map-pinned": MapPinnedIcon,
  route: RouteIcon,
  bus: BusIcon,
  car: CarIcon,
  truck: TruckIcon,
  "qr-code": QrCodeIcon,
  banknote: BanknoteIcon,
  hotel: HotelIcon,
  bed: BedIcon,
  key: KeyIcon,
  utensils: UtensilsIcon,
  briefcase: BriefcaseIcon,
  ticket: TicketIcon,
  "heart-pulse": HeartPulseIcon,
  handshake: HandshakeIcon,
  medal: MedalIcon,
  trophy: TrophyIcon,
  "id-card": IdCardIcon,
  "file-text": FileTextIcon,
  globe: GlobeIcon,
  clipboard: ClipboardIcon,
  leaf: LeafIcon,
  vegan: VeganIcon,
  "wheat-off": WheatOffIcon,
  "milk-off": MilkOffIcon,
  "fish-off": FishOffIcon,
  syringe: SyringeIcon,
  "help-circle": HelpCircleIcon,
  "badge-check": BadgeCheckIcon,
  // Tutoriales (Ayuda, Manual, Inicio guiado) y portales.
  building: BuildingIcon,
  landmark: LandmarkIcon,
  sun: SunIcon,
  moon: MoonIcon,
  "utensils-crossed": UtensilsCrossedIcon,
  smartphone: SmartphoneIcon,
  monitor: MonitorIcon,
  refresh: RefreshIcon,
  download: DownloadIcon,
  upload: UploadIcon,
  lock: LockIcon,
  message: MessageIcon,
  settings: SettingsIcon,
  sparkle: SparkleIcon,
  "life-buoy": LifeBuoyIcon,
  "hard-hat": HardHatIcon,
  plane: PlaneIcon,
  stethoscope: StethoscopeIcon,
  bot: BotIcon,
  "pen-line": PenLineIcon,
  camera: CameraIcon,
  image: ImageIcon,
  printer: PrinterIcon,
  "book-open": BookOpenIcon,
  phone: PhoneIcon,
  zap: ZapIcon,
  target: TargetIcon,
  save: SaveIcon,
  bell: BellIcon,
  compass: CompassIcon,
  dumbbell: DumbbellIcon,
  star: StarIcon,
  check: CheckIcon,
  x: XIcon,
  search: SearchIcon,
  "arrow-right": ArrowRightIcon,
  ambulance: AmbulanceIcon,
  flame: FlameIcon,
  siren: SirenIcon,
  fingerprint: FingerprintIcon,
  anchor: AnchorIcon,
} as const;

export type IconName = keyof typeof ICONS;

export const Icon = ({ name, ...p }: IconProps & { name: IconName }) => {
  const Glyph = ICONS[name];
  return <Glyph {...p} />;
};
