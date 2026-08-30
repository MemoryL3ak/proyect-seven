import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Exclusión explícita del control de acceso global (SA-BACKEND-03 · 5.3.1).
 * Sólo para endpoints que por naturaleza operan sin sesión: logins,
 * recuperación de código de acceso, health check, ingesta GPS transicional y
 * endpoints con un guard propio (API key de socios). Cada uso debe llevar
 * su justificación en un comentario.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
