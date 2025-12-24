import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get a setting value, prioritizing user-specific settings over global ones
   * @param key The setting key to retrieve
   * @param userId Optional user ID to retrieve user-specific settings
   * @param defaultValue Default value if setting is not found
   */
  async get(key: string, userId?: string, defaultValue?: string): Promise<string | null> {
    // First try to get user-specific setting
    if (userId) {
      const userSetting = await this.prisma.settings.findUnique({
        where: {
          userId_key: {
            // Using the composite unique constraint [userId, key]
            userId,
            key,
          },
        },
      });

      if (userSetting) {
        return userSetting.value;
      }
    }

    // If user-specific setting doesn't exist or no userId provided, try to get global setting (where userId is null)
    // Use findFirst instead of findUnique for global settings to avoid composite constraint issues
    const globalSetting = await this.prisma.settings.findFirst({
      where: {
        key,
        userId: null, // Global setting
      },
    });

    return globalSetting?.value || defaultValue || null;
  }

  /**
   * Set a setting value for a specific user or globally
   * @param key The setting key to set
   * @param value The value to set
   * @param userId Optional user ID - if provided, sets user-specific setting; otherwise sets global setting
   * @param description Optional description
   * @param category Setting category
   * @param isEncrypted Whether the value should be encrypted
   */
  async set(
    key: string,
    value: string,
    userId?: string,
    description?: string,
    category?: string,
    isEncrypted?: boolean,
  ): Promise<void> {
    if (userId) {
      // User-specific setting
      await this.prisma.settings.upsert({
        where: {
          userId_key: {
            userId,
            key,
          },
        },
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
          userId,
          description: description || undefined,
          category: category || 'general',
          isEncrypted: isEncrypted || false,
        },
      });
    } else {
      // Global setting (userId is null)
      // Query for existing global setting specifically
      const existingGlobal = await this.prisma.settings.findFirst({
        where: {
          key,
          userId: null,
        },
      });

      if (existingGlobal) {
        // Update existing global setting
        await this.prisma.settings.update({
          where: {
            id: existingGlobal.id,
          },
          data: {
            value,
            description: description || undefined,
            category: category || 'general',
            isEncrypted: isEncrypted || false,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new global setting
        await this.prisma.settings.create({
          data: {
            key,
            value,
            userId: null, // Global setting
            description: description || undefined,
            category: category || 'general',
            isEncrypted: isEncrypted || false,
          },
        });
      }
    }
  }

  /**
   * Get all settings for a specific user, falling back to global settings if needed
   * @param userId Optional user ID to get user-specific settings
   * @param category Optional category to filter settings
   */
  async getAll(
    userId?: string,
    category?: string,
  ): Promise<
    Array<{
      key: string;
      value: string | null;
      description: string | null;
      category: string;
      isUserSpecific: boolean; // Indicates if this is a user-specific setting
    }>
  > {
    // First get user-specific settings
    const userSettings = userId
      ? await this.prisma.settings.findMany({
          where: {
            userId,
            ...(category ? { category } : {}),
          },
          select: {
            key: true,
            value: true,
            description: true,
            category: true,
          },
          orderBy: {
            key: 'asc',
          },
        })
      : [];

    // Convert user settings to the proper format with isUserSpecific flag
    const userSettingsWithFlag = userSettings.map((setting) => ({
      ...setting,
      isUserSpecific: true,
    }));

    // Get global settings that don't conflict with user-specific ones
    const userSettingKeys = new Set(userSettings.map((setting) => setting.key));

    const globalWhereCondition: any = { userId: null };
    if (category) {
      globalWhereCondition.category = category;
    }

    const globalSettings = await this.prisma.settings.findMany({
      where: globalWhereCondition,
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

    // Filter out global settings that have been overridden by user-specific settings
    const filteredGlobalSettings = globalSettings.filter(
      (setting) => !userSettingKeys.has(setting.key),
    );

    // Convert global settings to the proper format with isUserSpecific flag
    const globalSettingsWithFlag = filteredGlobalSettings.map((setting) => ({
      ...setting,
      isUserSpecific: false,
    }));

    // Combine user-specific and global settings (user-specific take precedence)
    return [...userSettingsWithFlag, ...globalSettingsWithFlag];
  }

  /**
   * Delete a setting for a specific user or globally
   * @param key The setting key to delete
   * @param userId Optional user ID - if provided, deletes user-specific setting; otherwise deletes global setting
   */
  async delete(key: string, userId?: string): Promise<void> {
    if (userId) {
      // Delete user-specific setting
      await this.prisma.settings.delete({
        where: {
          userId_key: {
            userId,
            key,
          },
        },
      });
    } else {
      // Delete global setting (userId is null)
      await this.prisma.settings.deleteMany({
        where: {
          key,
          userId: null,
        },
      });
    }
  }

  /**
   * Check if a setting exists (either user-specific or global)
   * @param key The setting key to check
   * @param userId Optional user ID
   */
  async exists(key: string, userId?: string): Promise<boolean> {
    // Check if user-specific setting exists
    if (userId) {
      const userCount = await this.prisma.settings.count({
        where: {
          userId,
          key,
        },
      });

      if (userCount > 0) {
        return true;
      }
    }

    // Check if global setting exists
    const globalCount = await this.prisma.settings.count({
      where: {
        key,
        userId: null,
      },
    });

    return globalCount > 0;
  }

  /**
   * Get all global settings (where userId is null)
   */
  async getGlobalSettings(category?: string): Promise<
    Array<{
      key: string;
      value: string | null;
      description: string | null;
      category: string;
    }>
  > {
    const settings = await this.prisma.settings.findMany({
      where: {
        userId: null,
        ...(category ? { category } : {}),
      },
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

  /**
   * Bulk set multiple settings at once for a specific user
   * @param settings Array of settings to save
   * @param userId User ID to associate settings with
   */
  async bulkSet(
    settings: Array<{
      key: string;
      value: string;
      description?: string;
      category?: string;
      isEncrypted?: boolean;
    }>,
    userId: string,
  ): Promise<void> {
    // Use a transaction to ensure all settings are saved atomically
    await this.prisma.$transaction(
      settings.map((setting) =>
        this.prisma.settings.upsert({
          where: {
            userId_key: {
              userId,
              key: setting.key,
            },
          },
          update: {
            value: setting.value,
            description: setting.description || undefined,
            category: setting.category || 'general',
            isEncrypted: setting.isEncrypted || false,
            updatedAt: new Date(),
          },
          create: {
            key: setting.key,
            value: setting.value,
            userId,
            description: setting.description || undefined,
            category: setting.category || 'general',
            isEncrypted: setting.isEncrypted || false,
          },
        }),
      ),
    );
  }
}
