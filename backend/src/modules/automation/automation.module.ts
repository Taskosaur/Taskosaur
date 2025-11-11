import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationProcessor } from './automation.processor';
import { PrismaModule } from '../../prisma/prisma.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    GatewayModule,
    QueueModule,
    QueueModule.registerQueue({
      name: 'automation',
    }),
  ],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationProcessor],
  exports: [AutomationService],
})
export class AutomationModule {}
