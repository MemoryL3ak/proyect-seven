import { Body, Controller, Post } from '@nestjs/common';
import {
  MobileAuthService,
  MobileLoginResult,
  MobileRecoverResult,
} from './mobile-auth.service';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { MobileRecoverDto } from './dto/mobile-recover.dto';

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

  /** Sesión única: registra este dispositivo como la sesión activa del usuario. */
  @Post('session/claim')
  claimSession(@Body() body: { kind?: string; userId?: string }) {
    return this.mobileAuthService.claimSession(body ?? {});
  }

  /** Sesión única: valida que este dispositivo siga siendo la sesión activa. */
  @Post('session/validate')
  validateSession(@Body() body: { kind?: string; userId?: string; sessionId?: string }) {
    return this.mobileAuthService.validateSession(body ?? {});
  }
}
