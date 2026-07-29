export class FoodMenu {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  mealType: string; // DESAYUNO | ALMUERZO | CENA
  title: string;
  description?: string;
  dietaryType?: string; // ESTANDAR | VEGETARIANO | VEGANO | etc.
  accommodationId?: string;
  /** Tipos de cliente que ven este menú (vacío = todos). */
  clientTypes: string[];
  /** Sede donde se sirve (opcional). */
  venueId?: string;
  /** Detalle del lugar (comedor, piso, salón). */
  locationDetail?: string;
  createdAt: Date;
  updatedAt: Date;
}
