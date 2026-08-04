import { Body, Controller, Post } from '@nestjs/common';
import {
  MobileAuthService,
  MobileLoginResult,
  MobileRecoverResult,
} from './mobile-auth.service';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { MobileRecoverDto } from './dto/mobile-recover.dto';
import { MobileDeleteAccountDto } from './dto/mobile-delete-account.dto';

@Controller('m/auth')
export class MobileAuthController {
  constructor(private readonly mobileAuthService: MobileAuthService) {}

  @Post('login')
  async login(@Body() dto: MobileLoginDto): Promise<MobileLoginResult> {
    return this.mobileAuthService.login(dto);
  }

  @Post('recover')
  async recover(@Body() dto: MobileRecoverDto): Promise<MobileRecoverResult> {
    return this.mobileAuthService.recover(dto);
  }

  /**
   * Sesión única: intenta registrar este dispositivo como la sesión activa.
   * Si otro dispositivo ya tiene una sesión viva, responde claimed:false
   * (la sesión existente manda; el nuevo login se rechaza).
   */
  @Post('session/claim')
  claimSession(@Body() body: { kind?: string; userId?: string; currentSessionId?: string }) {
    return this.mobileAuthService.claimSession(body ?? {});
  }

  /** Sesión única: valida que este dispositivo siga siendo la sesión activa (y late). */
  @Post('session/validate')
  validateSession(@Body() body: { kind?: string; userId?: string; sessionId?: string }) {
    return this.mobileAuthService.validateSession(body ?? {});
  }

  /** Sesión única: libera la sesión al cerrar sesión. */
  @Post('session/release')
  releaseSession(@Body() body: { kind?: string; userId?: string; sessionId?: string }) {
    return this.mobileAuthService.releaseSession(body ?? {});
  }

  /**
   * Eliminación de cuenta a pedido del propio usuario (soft delete).
   * Requiere el código de acceso del portal como confirmación de identidad;
   * tras la baja, el login por código y las sesiones activas quedan inválidos.
   */
  @Post('account/delete')
  deleteAccount(@Body() dto: MobileDeleteAccountDto) {
    return this.mobileAuthService.deleteAccount(dto);
  }
}
