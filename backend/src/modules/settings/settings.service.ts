import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: string, defaultValue?: string): Promise<string | null> {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });

    return setting?.value || defaultValue || null;
  }

  async set(
    key: string,
    value: string,
    description?: string,
    category?: string,
    isEncrypted?: boolean,
  ): Promise<void> {
    await this.prisma.settings.upsert({
      where: { key },
      update: {
        value,
        description: description || undefined,
        category: category || 'general',
        isEncrypted: isEncrypted || false,
        updatedAt: new Date(),
      },
      create: {
        key,
        value,
        description: description || undefined,
        category: category || 'general',
        isEncrypted: isEncrypted || false,
      },
    });
  }

  async getAll(category?: string): Promise<
    Array<{
      key: string;
      value: string | null;
      description: string | null;
      category: string;
    }>
  > {
    const settings = await this.prisma.settings.findMany({
      where: category ? { category } : undefined,
      select: {
        key: true,
        value: true,
        description: true,
        category: true,
      },
      orderBy: {
        key: 'asc',
      },
    });

    return settings;
  }

  async delete(key: string): Promise<void> {
    await this.prisma.settings.delete({
      where: { key },
    });
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.prisma.settings.count({
      where: { key },
    });

    return count > 0;
  }
}
