import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CouponPartnersService } from './coupon-partners.service';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(private readonly partners: CouponPartnersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth =
      req.headers['x-partner-token'] ||
      req.headers['authorization']?.replace?.(/^Bearer\s+/i, '');

    if (!auth || typeof auth !== 'string') {
      throw new UnauthorizedException('Token de partner requerido');
    }

    const partner = await this.partners.verifyToken(auth);
    req.partner = partner;
    return true;
  }
}
