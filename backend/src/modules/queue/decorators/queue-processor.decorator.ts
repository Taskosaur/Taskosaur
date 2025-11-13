import { SetMetadata } from '@nestjs/common';

export const QUEUE_PROCESSOR_METADATA = 'queue:processor';
export const QUEUE_PROCESS_METADATA = 'queue:process';

/**
 * Decorator to mark a class as a queue processor
 * Works with both Bull and in-memory fallback
 */
export function QueueProcessor(queueName: string): ClassDecorator {
  return (target: any): any => {
    SetMetadata(QUEUE_PROCESSOR_METADATA, queueName)(target);
    return target;
  };
}

/**
 * Decorator to mark a method as a job processor
 * Works with both Bull and in-memory fallback
 */
export function QueueProcess(jobName: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(QUEUE_PROCESS_METADATA, jobName)(target, propertyKey, descriptor);
    return descriptor;
  };
}
