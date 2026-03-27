export class HotelExtraReservation {
  id: string;
  extraId: string;
  participantId: string;
  quantity: number;
  notes: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}
