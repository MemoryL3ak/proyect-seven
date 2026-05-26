export class HotelAssignment {
  id: string;
  participantId: string;
  hotelId: string;
  roomId?: string | null;
  preCheckinAt?: Date | null;
  earlyCheckinAt?: Date | null;
  checkinAt?: Date | null;
  checkoutAt?: Date | null;
  lateCheckoutAt?: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
