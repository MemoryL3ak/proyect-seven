/**
 * Títulos de las columnas de las cargas masivas (AND, inscripción, hotelería
 * y conductores). 28-09-2026: las plantillas mostraban los nombres internos
 * ("fecha_hora_llegada", "conductor_llegada", "is_delegation_lead"); Ariel
 * pidió nombres en español y que digan qué va en cada columna.
 *
 * La plantilla se descarga con estos títulos y la carga los lee de vuelta.
 * Los nombres internos se siguen aceptando: una planilla antigua sigue
 * funcionando igual.
 */
export const TITULO_COLUMNA: Record<string, string> = {
  // Evento y persona
  event_name: "Evento",
  event_id: "ID del evento (opcional)",
  country_code: "País",
  delegation: "Delegación o región",
  full_name: "Nombre completo",
  rut: "RUT",
  passport_number: "Pasaporte",
  email: "Correo electrónico",
  phone: "Teléfono",
  date_of_birth: "Fecha de nacimiento",
  gender: "Género",
  user_type: "Tipo de participante",
  discipline_name: "Disciplina",
  category: "Categoría",
  is_delegation_lead: "Jefe de delegación (SI/NO)",
  visa_required: "Requiere visa (SI/NO)",
  trip_type: "Tipo de viaje (Llegada/Salida)",
  // Llegada
  fecha_hora_llegada: "Llegada · fecha y hora",
  aerolinea_llegada: "Llegada · aerolínea",
  vuelo_llegada: "Llegada · número de vuelo",
  conductor_llegada: "Llegada · conductor",
  retiro_equipaje_llegada: "Llegada · retiro de equipaje",
  llegada_bolso_count: "Llegada · bolsos",
  llegada_maleta_8_count: "Llegada · maletas 8 kg",
  llegada_maleta_10_count: "Llegada · maletas 10 kg",
  llegada_maleta_15_count: "Llegada · maletas 15 kg",
  llegada_maleta_23_count: "Llegada · maletas 23 kg",
  llegada_sobreequipaje: "Llegada · sobreequipaje",
  llegada_volumen: "Llegada · volumen del equipaje",
  // Salida
  fecha_hora_salida: "Salida · fecha y hora",
  aerolinea_salida: "Salida · aerolínea",
  vuelo_salida: "Salida · número de vuelo",
  conductor_salida: "Salida · conductor",
  puerta_embarque_salida: "Salida · puerta de embarque",
  salida_bolso_count: "Salida · bolsos",
  salida_maleta_8_count: "Salida · maletas 8 kg",
  salida_maleta_10_count: "Salida · maletas 10 kg",
  salida_maleta_15_count: "Salida · maletas 15 kg",
  salida_maleta_23_count: "Salida · maletas 23 kg",
  salida_sobreequipaje: "Salida · sobreequipaje",
  salida_volumen: "Salida · volumen del equipaje",
  // Asistencia
  wheelchair_user: "Usa silla de ruedas (SI/NO)",
  wheelchair_standard_count: "Sillas de ruedas estándar",
  wheelchair_sport_count: "Sillas de ruedas deportivas",
  sports_equipment: "Equipamiento deportivo",
  requires_assistance: "Requiere asistencia (SI/NO)",
  observations: "Observaciones",
  // Hotel
  hotel_name: "Hotel",
  hotel_address: "Dirección del hotel",
  room_type: "Tipo de habitación",
  room_number: "Número de habitación",
  bed_type: "Tipo de cama",
  bed_status: "Estado de la cama",
  // Conductores
  provider_id: "ID del proveedor",
  license_number: "Número de licencia",
  vehicle_plate: "Patente",
  vehicle_type: "Tipo de vehículo",
  vehicle_brand: "Marca del vehículo",
  vehicle_model: "Modelo del vehículo",
  vehicle_capacity: "Capacidad del vehículo",
  vehicle_status: "Estado del vehículo",
  status: "Estado",
};

/** Sin tildes, mayúsculas ni signos: "Llegada · N° de vuelo" = "llegada n de vuelo". */
const comparable = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const CLAVE_POR_TITULO = new Map(Object.entries(TITULO_COLUMNA).map(([clave, titulo]) => [comparable(titulo), clave]));

/** Título en español de una columna (o la misma clave si no tiene). */
export const tituloDeColumna = (clave: string) => TITULO_COLUMNA[clave] ?? clave;

/**
 * Clave interna de un encabezado de la planilla: el título en español (con o
 * sin tildes, mayúsculas o signos) o el nombre interno de siempre.
 */
export function claveDeColumna(encabezado: string): string {
  const porTitulo = CLAVE_POR_TITULO.get(comparable(encabezado));
  if (porTitulo) return porTitulo;
  return encabezado.trim().toLowerCase().replace(/\s+/g, "_");
}
