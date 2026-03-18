export class SalonReservation {
  id: string;
  salonId: string;
  title: string;
  organizerName?: string | null;
  organizerEmail?: string | null;
  eventId?: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  attendees?: number | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
