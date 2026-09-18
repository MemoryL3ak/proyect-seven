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

/**
 * Vuelve a exigir identidad en un endpoint concreto de un controlador que es
 * @Public() a nivel de clase (p. ej. m/auth, que es el login del portal pero
 * también sirve datos que no se entregan sin sesión). El guard resuelve con
 * getAllAndOverride: el valor del método manda sobre el de la clase.
 */
export const Protected = () => SetMetadata(IS_PUBLIC_KEY, false);
