import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetSettingDto {
  @ApiProperty({
    description: 'Setting key',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Setting value',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: 'Setting description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Setting category',
    default: 'general',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Whether the value should be encrypted',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;
}

export class GetSettingDto {
  @ApiProperty({
    description: 'Setting key',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional({
    description: 'Default value if setting not found',
  })
  @IsOptional()
  @IsString()
  defaultValue?: string;
}

export class SettingResponseDto {
  @ApiProperty({
    description: 'Setting key',
  })
  key: string;

  @ApiProperty({
    description: 'Setting value',
  })
  value: string | null;

  @ApiPropertyOptional({
    description: 'Setting description',
  })
  description?: string | null;

  @ApiProperty({
    description: 'Setting category',
  })
  category: string;
}
