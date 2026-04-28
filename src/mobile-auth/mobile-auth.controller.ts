import type { Response } from 'express';
import { Body, Controller, Post, Res } from '@nestjs/common';
import { MobileAuthService, MobileLoginResult } from './mobile-auth.service';
import { MobileLoginDto } from './dto/mobile-login.dto';

@Controller('m/auth')
export class MobileAuthController {
  constructor(private readonly mobileAuthService: MobileAuthService) {}

  @Post('login')
  async login(
    @Body() dto: MobileLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<MobileLoginResult, 'session'>> {
    const result = await this.mobileAuthService.login(dto);

    if (result.kind === 'admin') {
      res.setHeader('Authorization', `Bearer ${result.session.access_token}`);
      res.setHeader('x-refresh-token', result.session.refresh_token);
      const { session: _omit, ...payload } = result;
      return payload;
    }

    return result;
  }
}
