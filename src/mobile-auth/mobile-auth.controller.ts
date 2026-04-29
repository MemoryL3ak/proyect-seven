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
}
