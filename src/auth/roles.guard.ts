import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'No user found on request. Ensure authentication middleware is applied before RolesGuard.',
      );
    }

    if (!user.role) {
      throw new ForbiddenException('User does not have a role assigned.');
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenException(
        `User role '${user.role}' is not authorized for this resource.`,
      );
    }

    return true;
  }
}
