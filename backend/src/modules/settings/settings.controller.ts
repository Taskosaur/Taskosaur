import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { SetSettingDto, SettingResponseDto } from './dto/settings.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  @ApiResponse({ status: 200, type: [SettingResponseDto] })
  async getAllSettings(@Query('category') category?: string) {
    return this.settingsService.getAll(category);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  @ApiResponse({ status: 200, type: SettingResponseDto })
  async getSetting(@Param('key') key: string, @Query('defaultValue') defaultValue?: string) {
    const value = await this.settingsService.get(key, defaultValue);
    return { key, value };
  }

  @Post()
  @ApiOperation({ summary: 'Set or update a setting' })
  @ApiResponse({
    status: 201,
    description: 'Setting created/updated successfully',
  })
  async setSetting(@Body() setSettingDto: SetSettingDto) {
    await this.settingsService.set(
      setSettingDto.key,
      setSettingDto.value,
      setSettingDto.description,
      setSettingDto.category,
      setSettingDto.isEncrypted,
    );
    return { message: 'Setting updated successfully' };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a setting' })
  @ApiResponse({ status: 200, description: 'Setting deleted successfully' })
  async deleteSetting(@Param('key') key: string) {
    await this.settingsService.delete(key);
    return { message: 'Setting deleted successfully' };
  }
}
