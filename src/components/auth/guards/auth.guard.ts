import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const type = ctx.getType<'http' | 'graphql' | 'ws'>();

    const getToken = (): string | null => {
      if (type === 'http') {
        const req = ctx.switchToHttp().getRequest();
        return req.headers?.authorization?.split(' ')[1] ?? null;
      }
      if (type === 'graphql') {
        const req = (ctx as any).getArgByIndex(2).req;
        return req.headers?.authorization?.split(' ')[1] ?? null;
      }
      if (type === 'ws') {
        const client: any = ctx.switchToWs().getClient();
        // allow either header or query/handshake auth
        return client?.handshake?.auth?.token
            || client?.handshake?.headers?.authorization?.split(' ')[1]
            || client?.token
            || null;
      }
      return null;
    };

    const token = getToken();
    if (!token) throw new BadRequestException('TOKEN_NOT_EXIST');

    const user = await this.auth.verifyToken(token);
    if (!user) throw new UnauthorizedException('NOT_AUTHENTICATED');

    // attach user
    if (type === 'http') ctx.switchToHttp().getRequest().user = user;
    if (type === 'graphql') (ctx as any).getArgByIndex(2).req.user = user;
    if (type === 'ws') ctx.switchToWs().getClient().user = user;

    return true;
  }
}
