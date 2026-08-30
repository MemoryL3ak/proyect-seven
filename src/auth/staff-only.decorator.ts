import { SetMetadata } from '@nestjs/common';

export const STAFF_ONLY_KEY = 'staffOnly';

/**
 * Restringe el endpoint (o el controller completo) al personal del panel de
 * administración: las sesiones de portal (atleta / conductor / staff de
 * proveedor) reciben 403 aunque estén autenticadas.
 */
export const StaffOnly = () => SetMetadata(STAFF_ONLY_KEY, true);
