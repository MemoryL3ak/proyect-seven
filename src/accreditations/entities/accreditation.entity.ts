export class Accreditation {
  id: string;
  eventId: string;
  athleteId?: string | null;
  driverId?: string | null;
  subjectType: 'PARTICIPANT' | 'DRIVER';
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CREDENTIAL_ISSUED';
  validationNotes?: string | null;
  validatedBy?: string | null;
  validatedAt?: Date | null;
  credentialCode?: string | null;
  credentialIssuedAt?: Date | null;
  credentialIssuedBy?: string | null;
  accessTypes?: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
