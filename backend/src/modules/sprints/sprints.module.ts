import { Module } from '@nestjs/common';
import { SprintsService } from './sprints.service';
import { SprintsController } from './sprints.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccessControlService } from '../../common/access-control.utils';

@Module({
  imports: [PrismaModule],
  controllers: [SprintsController],
  providers: [SprintsService, AccessControlService],
  exports: [SprintsService],
})
export class SprintsModule {}
