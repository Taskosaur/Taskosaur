import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  DocumentsController,
  OrganizationDocumentsController,
  WorkspaceDocumentsController,
} from './documents.controller';
import { DocumentsService } from './documents.service';
@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController, OrganizationDocumentsController, WorkspaceDocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
