import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "../auth.service";

@Injectable()
export class WithoutGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const type = ctx.getType<'http' | 'graphql' | 'ws'>();
    const tryAttach = async (reqOrClient: any) => {
      const bearer = reqOrClient?.headers?.authorization;
      const token = reqOrClient?.handshake?.auth?.token || bearer?.split(' ')[1];
      if (!token) { reqOrClient.user = null; return; }
      try { reqOrClient.user = await this.auth.verifyToken(token); }
      catch { reqOrClient.user = null; }
    };

    if (type === 'http') await tryAttach(ctx.switchToHttp().getRequest());
    if (type === 'graphql') await tryAttach((ctx as any).getArgByIndex(2).req);
    if (type === 'ws') await tryAttach(ctx.switchToWs().getClient());

    return true;
  }
}
