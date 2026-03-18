export class Salon {
  id: string;
  hotelId: string;
  name: string;
  type: string;
  capacity: number;
  status: string;
  floor?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
