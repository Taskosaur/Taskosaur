import { IsString, IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRuleDto {
  @ApiProperty({ description: 'Rule name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Rule priority (higher runs first)' })
  @IsNumber()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether rule is enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({
    description: 'Rule conditions in JSON format',
    example: {
      any: [
        { from: { contains: '@vip-customer.com' } },
        { subject: { matches: 'urgent|critical' } },
      ],
    },
  })
  @IsObject()
  conditions: any;

  @ApiProperty({
    description: 'Actions to perform when rule matches',
    example: {
      setPriority: 'HIGH',
      assignTo: 'user-id',
      addLabels: ['vip', 'urgent'],
      autoReply: 'template-id',
    },
  })
  @IsObject()
  actions: any;

  @ApiPropertyOptional({
    description: 'Stop processing rules after this one matches',
  })
  @IsBoolean()
  @IsOptional()
  stopOnMatch?: boolean;
}

export class UpdateRuleDto extends CreateRuleDto {}
