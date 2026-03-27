export class FoodLocation {
  id: string;
  accommodationId?: string;
  name: string;
  description?: string;
  capacity?: number;
  clientTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}
