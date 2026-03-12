export class HotelKey {
  id: string;
  hotelId: string;
  roomId: string;
  bedId?: string | null;
  keyNumber: string;
  copyNumber: number;
  label?: string | null;
  status: string;
  holderName?: string | null;
  holderType?: string | null;
  holderParticipantId?: string | null;
  issuedAt?: Date | null;
  returnedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
