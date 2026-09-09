import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import {
  ChangeTemporaryPasswordDto,
  CreateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
} from './dto/users.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly logger: Logger = new Logger(AuthService.name),
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  async register({
    name,
    email,
    username,
    password,
    role,
    modules,
    isTemporaryPassword,
  }: CreateUserDto): Promise<{ user: User }> {
    const resolvedEmail = email
      ? String(email).trim().toLowerCase()
      : `${String(username || '').trim().toLowerCase()}@nomail.seven`;

    // Email users: temporary by default. Username users: permanent by default.
    const forceChange = isTemporaryPassword ?? !!email;

    this.logger.log(`Registering user: ${resolvedEmail} (username: ${!!username})`);

    const { data, error } = await this.supabase.auth.admin.createUser({
      email: resolvedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        // Sin esto, el usuario nuevo quedaba sin módulos en metadata y el
        // menú lateral le mostraba TODO el panel (sin módulos = acceso total).
        ...(Array.isArray(modules) && modules.length > 0 ? { modules } : {}),
        ...(username ? { username } : {}),
        forcePasswordChange: forceChange,
        force_password_change: forceChange,
      },
    });

    if (error || !data.user) {
      this.logger.error('Register error', JSON.stringify(error));
      throw new BadRequestException(error?.message || 'Unexpected error during registration');
    }

    this.logger.log(`User created: ${data.user.id}`);
    return { user: data.user };
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.admin.deleteUser(id);
    if (error) {
      this.logger.error('deleteUser error', JSON.stringify(error));
      throw new BadRequestException(error.message || 'Error deleting user');
    }
    this.logger.log(`User deleted: ${id}`);
    return { message: 'Usuario eliminado correctamente' };
  }

  async listUsers(): Promise<{ users: User[] }> {
    const { data, error } = await this.supabase.auth.admin.listUsers();
    if (error) {
      this.logger.error('listUsers error', JSON.stringify(error));
      throw new BadRequestException(error.message);
    }
    return { users: data.users };
  }

  async updateUser(
    id: string,
    data: { name?: string; role?: string; password?: string; modules?: string[] },
  ): Promise<{ user: User }> {
    const { data: result, error } = await this.supabase.auth.admin.updateUserById(id, {
      ...(data.password ? { password: data.password } : {}),
      email_confirm: true,
      user_metadata: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.modules ? { modules: data.modules } : {}),
        ...(data.password
          ? {
              forcePasswordChange: true,
              force_password_change: true,
            }
          : {}),
      },
    });
    if (error || !result.user) {
      this.logger.error('updateUser error', JSON.stringify(error));
      throw new BadRequestException(error?.message || 'Error updating user');
    }
    return { user: result.user };
  }

  async confirmUserEmail(id: string): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.admin.updateUserById(id, {
      email_confirm: true,
    });
    if (error) {
      this.logger.error('confirmUserEmail error', JSON.stringify(error));
      throw new BadRequestException(error.message);
    }
    return { message: 'Email confirmed successfully' };
  }

  async disableUser(id: string): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.admin.updateUserById(id, {
      ban_duration: '876000h', // ~100 years = effectively disabled
    });
    if (error) {
      this.logger.error('disableUser error', JSON.stringify(error));
      throw new BadRequestException(error.message);
    }
    return { message: 'User disabled successfully' };
  }

  async enableUser(id: string): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.admin.updateUserById(id, {
      ban_duration: 'none',
    });
    if (error) {
      this.logger.error('enableUser error', JSON.stringify(error));
      throw new BadRequestException(error.message);
    }
    return { message: 'User enabled successfully' };
  }

  /**
   * Autoeliminación desde "Mi Cuenta". Las cuentas Administrador no pueden
   * autoeliminarse (regla aplicada aquí, no solo ocultando el botón).
   */
  async deleteOwnAccount(userId: string): Promise<{ message: string }> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);
    if (error || !data.user) {
      throw new BadRequestException(error?.message || 'Usuario no encontrado');
    }
    const role = String(
      (data.user.user_metadata as Record<string, unknown> | undefined)?.role ?? '',
    ).toLowerCase();
    if (role === 'administrador') {
      throw new ForbiddenException(
        'Las cuentas de administrador no pueden autoeliminarse. Pide a otro administrador que la elimine desde Gestión de Usuarios.',
      );
    }
    const { error: deleteError } = await this.supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      this.logger.error('deleteOwnAccount error', JSON.stringify(deleteError));
      throw new BadRequestException(deleteError.message);
    }
    this.logger.log(`Self-deleted panel account ${userId} (role: ${role || 'sin rol'})`);
    return { message: 'Cuenta eliminada' };
  }

  /**
   * Cambio de contraseña desde "Mi Cuenta": verifica la clave actual con un
   * login real (mismo patrón que changeTemporaryPassword) y fija la nueva
   * sin marcar forcePasswordChange.
   */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);
    if (error || !data.user?.email) {
      throw new BadRequestException(error?.message || 'Usuario no encontrado');
    }

    const { error: signInError } = await this.supabase.auth.signInWithPassword({
      email: data.user.email,
      password: currentPassword,
    });
    if (signInError) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const currentMetadata = (data.user.user_metadata || {}) as Record<string, unknown>;
    const { error: updateError } = await this.supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
      user_metadata: {
        ...currentMetadata,
        forcePasswordChange: false,
        force_password_change: false,
      },
    });
    if (updateError) {
      throw new BadRequestException(updateError.message || 'Error actualizando la contraseña');
    }
    return { message: 'Contraseña actualizada' };
  }

  async login({
    email,
    password,
  }: LoginUserDto): Promise<{ user: User; session: Session }> {
    let normalizedEmail = String(email || '').trim().toLowerCase();
    // Support username login: if no @ present, treat as username@nomail.seven
    if (!normalizedEmail.includes('@')) {
      normalizedEmail = `${normalizedEmail}@nomail.seven`;
    }
    const normalizedPassword = String(password || '').trim();

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (error) {
        const code = String((error as { code?: string })?.code || '').toLowerCase();
        const message = String(error.message || '');
        this.logger.error(`Error during login (${code || 'no_code'}): ${message}`);

        if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
          throw new UnauthorizedException('Invalid email or password');
        }
        if (/email not confirmed/i.test(message)) {
          throw new UnauthorizedException('Email not confirmed');
        }
        if (/user is banned|user not allowed/i.test(message)) {
          throw new UnauthorizedException('User disabled');
        }
        throw new BadRequestException(message || 'Login failed');
      }

      if (!data.user || !data.session) {
        throw new UnauthorizedException('Unable to authenticate');
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (err: any) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException
      ) {
        throw err;
      }
      this.logger.error('Unexpected error during login', err);
      throw new InternalServerErrorException(
        'Internal error processing login. Please try again later.',
      );
    }
  }

  async getUser(token: string): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new Error(error?.message || 'Unexpected error retrieving user');
    }

    return data.user;
  }

  async loginWithGoogle(): Promise<{ url: string }> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: process.env.WEB_CALLBACK_URL,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Unexpected error during Google login');
    }

    if (!data?.url) {
      throw new Error('No URL returned from Supabase');
    }

    return { url: data.url };
  }

  async recoverPassword(email: string): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.APP_CALLBACK_URL,
    });

    if (error) {
      throw new Error(error.message || 'Error requesting password recovery');
    }

    return { message: 'Password recovery email sent successfully' };
  }

  async logout(): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error(error.message ?? 'Error during logout');
    }

    return { message: 'Logout successful' };
  }

  async updatePassword({
    newPassword,
  }: UpdatePasswordDto): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message || 'Error updating password');
    }

    return { message: 'Password updated successfully' };
  }

  async validateToken(accessToken: string): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return data.user;
  }

  async refreshSession(
    refreshToken: string,
  ): Promise<{ session: Session; user: User }> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException(
        'Invalid or expired refresh token. Please login again',
      );
    }

    return {
      session: data.session,
      user: data.user,
    };
  }

  async changeTemporaryPassword({
    email,
    temporaryPassword,
    newPassword,
  }: ChangeTemporaryPasswordDto): Promise<{ message: string }> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const tempPassword = String(temporaryPassword || '').trim();
    const nextPassword = String(newPassword || '').trim();

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: tempPassword,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid temporary credentials');
    }

    const currentMetadata = (data.user.user_metadata || {}) as Record<string, unknown>;
    const { error: updateError } = await this.supabase.auth.admin.updateUserById(data.user.id, {
      password: nextPassword,
      user_metadata: {
        ...currentMetadata,
        forcePasswordChange: false,
        force_password_change: false,
      },
    });

    if (updateError) {
      throw new BadRequestException(updateError.message || 'Error updating temporary password');
    }

    return { message: 'Password updated successfully' };
  }
}
