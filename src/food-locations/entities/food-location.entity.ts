export class FoodLocation {
  id: string;
  /** Evento del comedor; sin evento se ve en todos. */
  eventId?: string;
  accommodationId?: string;
  name: string;
  /** Calle y número; puede diferir del hotel asociado. */
  address?: string;
  description?: string;
  capacity?: number;
  clientTypes: string[];
  /** Regiones que comen aquí. Vacío = todas. */
  delegationIds: string[];
  /** Deportes que comen aquí. Vacío = todos. */
  disciplineIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
