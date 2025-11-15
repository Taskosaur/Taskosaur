import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { S3Service } from '../storage/s3.service';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, S3Service, StorageService],
  exports: [UsersService],
})
export class UsersModule {}
