import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthMember = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    let req: any;

    switch (ctx.getType<'http' | 'graphql' | 'ws'>()) {
      case 'http':
        req = ctx.switchToHttp().getRequest();
        break;
      case 'graphql':
        req = (ctx as any).getArgByIndex(2)?.req;
        break;
      case 'ws':
        req = ctx.switchToWs().getClient(); // put user on client in WS guard
        break;
    }

    const user = req?.user ?? req?.body?.authMember ?? null;
    return user ? (data ? user[data] : user) : null;
  },
);
