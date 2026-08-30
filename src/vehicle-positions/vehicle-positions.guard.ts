import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  VehiclePositionsAccessService,
  VpRequest,
} from './vehicle-positions.access.service';

/**
 * Autenticación del módulo de posiciones (SA-BACKEND-02): identifica al
 * llamante (staff del panel o sesión de portal) y lo deja en req.vpCaller
 * para que cada handler aplique su autorización. Sin credenciales → 401.
 *
 * Única excepción transicional: la ingesta GPS (POST create) en modo 'log',
 * mientras el shell nativo aún no adjunta la sesión del conductor — la
 * decisión de aceptarla la toma assertCanIngest, que deja registro.
 */
@Injectable()
export class VehiclePositionsGuard implements CanActivate {
  constructor(private readonly access: VehiclePositionsAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<VpRequest>();
    const caller = await this.access.identify(req);
    if (caller) {
      req.vpCaller = caller;
      return true;
    }
    if (
      req.method === 'POST' &&
      context.getHandler().name === 'create' &&
      !this.access.ingestEnforced()
    ) {
      req.vpCaller = null;
      return true;
    }
    throw new UnauthorizedException('Autenticación requerida');
  }
}
