import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator'; // if you exported key
import { SystemRole } from '../../../libs/enums/system-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY ?? 'roles', [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const type = ctx.getType<'http' | 'graphql' | 'ws'>();
    const user =
      type === 'http' ? ctx.switchToHttp().getRequest().user :
      type === 'graphql' ? (ctx as any).getArgByIndex(2).req.user :
      ctx.switchToWs().getClient().user;

    if (!user || !required.includes(user.systemRole)) {
      throw new ForbiddenException('ONLY_SPECIFIC_ROLES_ALLOWED');
    }
    return true;
  }
}
