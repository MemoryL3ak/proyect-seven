import { Public } from './public.decorator';
import { StaffOnly } from './staff-only.decorator';
import type { Response } from 'express';
import { Controller, Post, Get, Patch, Delete, Body, Param, Req, Res, Put, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { ApiRequest } from './api-auth.guard';
import { ChangeOwnPasswordDto, ChangeTemporaryPasswordDto, CreateUserDto, LoginUserDto } from './dto/users.dto';

/** Gestión de usuarios del panel: solo staff. Login y cambio de clave temporal son públicos. */
@StaffOnly()
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

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  @Patch('users/:id/confirm-email')
  async confirmUserEmail(@Param('id') id: string) {
    return this.authService.confirmUserEmail(id);
  }

  @Patch('users/:id/disable')
  async disableUser(@Param('id') id: string) {
    return this.authService.disableUser(id);
  }

  @Patch('users/:id/enable')
  async enableUser(@Param('id') id: string) {
    return this.authService.enableUser(id);
  }

  /** Autoeliminación desde "Mi Cuenta" (bloqueada para Administrador). */
  @Delete('me')
  async deleteOwnAccount(@Req() req: ApiRequest) {
    const caller = req.apiCaller;
    if (caller?.type !== 'staff') {
      throw new UnauthorizedException('Sesión del panel requerida');
    }
    return this.authService.deleteOwnAccount(caller.userId);
  }

  /** Cambio de contraseña de la propia cuenta desde "Mi Cuenta". */
  @Patch('me/password')
  async changeOwnPassword(@Req() req: ApiRequest, @Body() dto: ChangeOwnPasswordDto) {
    const caller = req.apiCaller;
    if (caller?.type !== 'staff') {
      throw new UnauthorizedException('Sesión del panel requerida');
    }
    return this.authService.changeOwnPassword(caller.userId, dto.currentPassword, dto.newPassword);
  }

  @Public()
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

  /**
   * Renueva la sesión del panel cuando el access token expira (~1 h).
   * @Public: la credencial es el propio refresh token, validado por Supabase.
   * Devuelve los tokens nuevos en los mismos headers que el login.
   */
  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = String(body?.refreshToken || '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException('refreshToken requerido');
    }
    const { user, session } = await this.authService.refreshSession(refreshToken);
    res.setHeader('Authorization', `Bearer ${session.access_token}`);
    res.setHeader('x-refresh-token', session.refresh_token);
    return { user };
  }

  @Public()
  @Post('change-temporary-password')
  async changeTemporaryPassword(@Body() dto: ChangeTemporaryPasswordDto) {
    return this.authService.changeTemporaryPassword(dto);
  }
}
