export class FoodMenu {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  mealType: string; // DESAYUNO | ALMUERZO | CENA
  title: string;
  description?: string;
  dietaryType?: string; // ESTANDAR | VEGETARIANO | VEGANO | etc.
  accommodationId?: string;
  createdAt: Date;
  updatedAt: Date;
}
