import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const started = Date.now();
    const type = context.getType<GqlContextType>();

    // GraphQL branch
    if (type === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      const req = gqlCtx.getContext()?.req;
      const info = gqlCtx.getInfo?.();
      const opName = req?.body?.operationName ?? '(anonymous)';
      const variables = req?.body?.variables ?? {};
      const field = info?.fieldName;
      const parent = info?.parentType?.name;

      // Request log (masked + truncated)
      this.logger.log(
        `GQL ${parent}.${field} op=${opName} vars=${this.s(variables)}`,
        'Request',
      );

      return next.handle().pipe(
        tap({
          next: (res) => {
            const ms = Date.now() - started;
            this.logger.log(
              `GQL ${parent}.${field} -> ${this.s(res)} (${ms}ms)\n`,
              'Response',
            );
          },
          error: (err) => {
            const ms = Date.now() - started;
            // keep it short; don’t dump huge stacks into logs
            this.logger.error(
              `GQL ${parent}.${field} !! ${err?.name || 'Error'}: ${err?.message} (${ms}ms)`,
            );
          },
        }),
      );
    }

    // HTTP (or other) – pass through (you can add similar logging if you want)
    return next.handle();
  }

  /** Safe stringify with masking + truncation */
  private s(value: unknown, max = 200): string {
    try {
      const seen = new WeakSet();
      const masked = this.mask(value);
      const json = JSON.stringify(masked, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
      return json.length > max ? json.slice(0, max) + '…' : json;
    } catch {
      return '[Unserializable]';
    }
  }

  /** Mask sensitive fields recursively */
  private mask(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
      if (/(password|passcode|token|authorization|secret)/i.test(k)) {
        out[k] = '***';
      } else {
        out[k] = this.mask(v);
      }
    }
    return out;
  }
}
