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

  @ApiPropertyOptional({ description: 'Reject unauthorized certificates for IMAP' })
  @IsBoolean()
  @IsOptional()
  imapTlsRejectUnauth?: boolean;

  @ApiPropertyOptional({ description: 'Minimum TLS version for IMAP (e.g., TLSv1.2)' })
  @IsString()
  @IsOptional()
  imapTlsMinVersion?: string;

  @ApiPropertyOptional({
    description: 'SNI hostname for IMAP TLS validation (optional, for IP-based connections)',
  })
  @IsString()
  @IsOptional()
  imapServername?: string;

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

  @ApiPropertyOptional({ description: 'Reject unauthorized certificates for SMTP' })
  @IsBoolean()
  @IsOptional()
  smtpTlsRejectUnauth?: boolean;

  @ApiPropertyOptional({ description: 'Minimum TLS version for SMTP (e.g., TLSv1.2)' })
  @IsString()
  @IsOptional()
  smtpTlsMinVersion?: string;

  @ApiPropertyOptional({
    description: 'SNI hostname for SMTP TLS validation (optional, for IP-based connections)',
  })
  @IsString()
  @IsOptional()
  smtpServername?: string;

  @ApiPropertyOptional({ description: 'Force STARTTLS upgrade (prevents plaintext fallback)' })
  @IsBoolean()
  @IsOptional()
  smtpRequireTls?: boolean;
}
