import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// For now, using in-memory storage. In production, use Redis
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const RATE_LIMIT_KEY = 'rate_limit';
export const RateLimit = (limit: number, windowMs: number = 60000) => {
  return (target: object, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(
        RATE_LIMIT_KEY,
        { limit, windowMs },
        descriptor.value as object,
      );
    } else {
      Reflect.defineMetadata(RATE_LIMIT_KEY, { limit, windowMs }, target);
    }
  };
};

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request as { ip?: string; connection?: { remoteAddress?: string }; socket?: { remoteAddress?: string }; headers?: Record<string, string | string[]> });
    const endpoint = this.getEndpointType(request.url as string);

    // Get rate limit from decorator or use default
    const rateLimitConfig =
      this.reflector.getAllAndOverride<{ limit: number; windowMs: number }>(
        RATE_LIMIT_KEY,
        [context.getHandler(), context.getClass()],
      ) || this.getDefaultLimit(endpoint);

    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const windowMs = rateLimitConfig.windowMs;
    const limit = rateLimitConfig.limit;

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new window
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      // Increment count in current window
      entry.count++;
    }

    rateLimitStore.set(key, entry);

    // Check if limit exceeded
    if (entry.count > limit) {
      throw new HttpException(
        {
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
          statusCode: 429,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: number) => void }>();
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, limit - entry.count),
    );
    response.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    return true;
  }

  private getClientIp(request: { ip?: string; connection?: { remoteAddress?: string }; socket?: { remoteAddress?: string }; headers?: Record<string, string | string[]> }): string {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const forwardedIp = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0] : Array.isArray(forwardedFor) ? forwardedFor[0] : undefined;

    return request.ip ||
           request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           forwardedIp ||
           'unknown';
  }

  private getEndpointType(url: string): string {
    if (url.includes('/search')) return 'search';
    if (url.includes('/projects') && !url.includes('/projects/'))
      return 'projects';
    if (url.includes('/tasks')) return 'tasks';
    if (url.includes('/sprints')) return 'sprints';
    if (url.includes('/calendar')) return 'calendar';
    return 'default';
  }

  private getDefaultLimit(endpoint: string): {
    limit: number;
    windowMs: number;
  } {
    const limits: Record<string, { limit: number; windowMs: number }> = {
      search: { limit: 10, windowMs: 60000 }, // 10 per minute for search
      projects: { limit: 50, windowMs: 60000 }, // 50 per minute for project lists
      tasks: { limit: 30, windowMs: 60000 }, // 30 per minute for tasks
      sprints: { limit: 30, windowMs: 60000 }, // 30 per minute for sprints
      calendar: { limit: 20, windowMs: 60000 }, // 20 per minute for calendar
      default: { limit: 100, windowMs: 60000 }, // 100 per minute for other endpoints
    };

    return limits[endpoint] || limits.default;
  }

  // Cleanup old entries periodically (should be called by a cron job)
  static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// Export rate limit decorators for easy use
export const SearchRateLimit = () => RateLimit(10, 60000); // 10 per minute
export const ProjectRateLimit = () => RateLimit(50, 60000); // 50 per minute
export const TaskRateLimit = () => RateLimit(30, 60000); // 30 per minute
export const DefaultRateLimit = () => RateLimit(100, 60000); // 100 per minute
