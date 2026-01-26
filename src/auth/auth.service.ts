import {
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import {
  CreateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
} from './dto/users.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly logger: Logger = new Logger(AuthService.name),
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  async register({
    name,
    email,
    password,
    role,
  }: CreateUserDto): Promise<{ user: User; session: Session }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
        emailRedirectTo: process.env.APP_CALLBACK_URL,
      },
    });

    if (error || !data.user || !data.session) {
      throw new Error(error?.message || 'Unexpected error during registration');
    }

    return {
      user: data.user ?? null,
      session: data.session ?? null,
    };
  }

  async login({
    email,
    password,
  }: LoginUserDto): Promise<{ user: User; session: Session }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        this.logger.error('Error during login', error);
        if (
          error.status === 400 ||
          /invalid login credentials/i.test(error.message)
        ) {
          throw new UnauthorizedException('Invalid email or password');
        }
        throw new BadRequestException(error.message);
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
}
