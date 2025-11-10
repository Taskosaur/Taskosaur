import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createAuditExtension } from './audit.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
    return this.$extends(createAuditExtension()) as this;
  }

  async onModuleInit() {
    await this.$connect();
  }
}
