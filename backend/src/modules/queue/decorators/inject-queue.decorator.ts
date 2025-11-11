import { Inject } from '@nestjs/common';

/**
 * Get queue provider token
 */
export function getQueueToken(name: string): string {
  return `QUEUE_${name}`;
}

/**
 * Decorator to inject a queue by name
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(
 *     @InjectQueue('email') private emailQueue: IQueue<EmailJobData>
 *   ) {}
 * }
 * ```
 */
export function InjectQueue(name: string): ParameterDecorator {
  return Inject(getQueueToken(name));
}
