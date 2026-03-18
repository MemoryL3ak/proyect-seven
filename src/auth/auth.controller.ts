import type { Response } from 'express';
import { Controller, Post, Get, Patch, Body, Param, Res, Put } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangeTemporaryPasswordDto, CreateUserDto, LoginUserDto } from './dto/users.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Get('users')
  async listUsers() {
    return this.authService.listUsers();
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: { name?: string; role?: string; password?: string }) {
    return this.authService.updateUser(id, body);
  }

  @Patch('users/:id/disable')
  async disableUser(@Param('id') id: string) {
    return this.authService.disableUser(id);
  }

  @Patch('users/:id/enable')
  async enableUser(@Param('id') id: string) {
    return this.authService.enableUser(id);
  }

  @Post('login')
  async login(
    @Body() dto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.authService.login(dto);
    const metadata = (user.user_metadata as Record<string, unknown> | undefined) || {};
    const requiresPasswordChange = Boolean(
      metadata.forcePasswordChange ?? metadata.force_password_change,
    );
    res.setHeader('Authorization', `Bearer ${session!.access_token}`);
    res.setHeader('x-refresh-token', session!.refresh_token);
    return {
      user,
      requiresPasswordChange,
    };
  }

  @Post('change-temporary-password')
  async changeTemporaryPassword(@Body() dto: ChangeTemporaryPasswordDto) {
    return this.authService.changeTemporaryPassword(dto);
  }
}
