export class HotelRoom {
  id: string;
  hotelId: string;
  roomNumber: string;
  roomType: string;
  bedsCapacity: number;
  baseBedType?: string | null;
  defaultBedType?: string | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
