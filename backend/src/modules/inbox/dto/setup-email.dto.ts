import { IsString, IsNumber, IsBoolean, IsOptional, IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetupEmailDto {
  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  emailAddress: string;

  @ApiPropertyOptional({ description: 'Display name for emails' })
  @IsString()
  @IsOptional()
  displayName?: string;

  // Basic Auth fields
  @ApiProperty({ description: 'IMAP host' })
  @IsString()
  @IsNotEmpty()
  imapHost: string;

  @ApiPropertyOptional({ description: 'IMAP port' })
  @IsNumber()
  @IsOptional()
  imapPort?: number;

  @ApiProperty({ description: 'IMAP username' })
  @IsString()
  @IsNotEmpty()
  imapUsername: string;

  @ApiProperty({ description: 'IMAP password' })
  @IsString()
  @IsNotEmpty()
  imapPassword: string;

  @ApiPropertyOptional({ description: 'Use SSL for IMAP' })
  @IsBoolean()
  @IsOptional()
  imapUseSsl?: boolean;

  @ApiPropertyOptional({ description: 'IMAP folder to monitor' })
  @IsString()
  @IsOptional()
  imapFolder?: string;

  @ApiProperty({ description: 'SMTP host' })
  @IsString()
  @IsNotEmpty()
  smtpHost: string;

  @ApiPropertyOptional({ description: 'SMTP port' })
  @IsNumber()
  @IsOptional()
  smtpPort?: number;

  @ApiProperty({ description: 'SMTP username' })
  @IsString()
  @IsNotEmpty()
  smtpUsername: string;

  @ApiProperty({ description: 'SMTP password' })
  @IsString()
  @IsNotEmpty()
  smtpPassword: string;

  @ApiPropertyOptional({ description: 'Use TLS for SMTP' })
  @IsBoolean()
  @IsOptional()
  smtpUseTls?: boolean;
}
