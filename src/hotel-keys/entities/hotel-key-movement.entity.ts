export class HotelKeyMovement {
  id: string;
  keyId: string;
  action: string;
  holderName?: string | null;
  holderType?: string | null;
  holderParticipantId?: string | null;
  actorName?: string | null;
  notes?: string | null;
  happenedAt: Date;
  createdAt: Date;
}
