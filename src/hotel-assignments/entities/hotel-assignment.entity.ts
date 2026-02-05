export class HotelAssignment {
  id: string;
  participantId: string;
  hotelId: string;
  roomId?: string | null;
  bedId?: string | null;
  checkinAt?: Date | null;
  checkoutAt?: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
