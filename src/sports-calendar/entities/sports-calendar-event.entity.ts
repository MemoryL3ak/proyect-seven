export class SportsCalendarEvent {
  id: string;
  eventId?: string | null;
  sport: string;
  league: string;
  season?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  venue?: string | null;
  startAtUtc: Date;
  status: string;
  scoreHome?: number | null;
  scoreAway?: number | null;
  externalId?: string | null;
  source?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
