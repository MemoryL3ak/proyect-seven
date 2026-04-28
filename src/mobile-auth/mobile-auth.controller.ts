import { Body, Controller, Post } from '@nestjs/common';
import { MobileAuthService, MobileLoginResult } from './mobile-auth.service';
import { MobileLoginDto } from './dto/mobile-login.dto';

@Controller('m/auth')
export class MobileAuthController {
  constructor(private readonly mobileAuthService: MobileAuthService) {}

  @Post('login')
  async login(@Body() dto: MobileLoginDto): Promise<MobileLoginResult> {
    return this.mobileAuthService.login(dto);
  }
}
