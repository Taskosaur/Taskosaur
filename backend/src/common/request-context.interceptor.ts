// common/request-context.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const user = request.user; // Provided by your AuthGuard

    // Build a request context object
    const ctx = {
      userId: user?.id,
      user,
    };

    return RequestContextService.run(ctx, () => next.handle());
  }
}
