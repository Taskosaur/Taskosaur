import { Controller, Post, Body, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { SendEmailDto, BulkEmailDto } from './dto/email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Email')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send email notification',
    description: 'Queue an email for sending using background processing',
  })
  @ApiBody({ type: SendEmailDto })
  @ApiResponse({
    status: 202,
    description: 'Email queued successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email queued successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email data' })
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    await this.emailService.sendEmail(sendEmailDto);
    return { message: 'Email queued successfully' };
  }

  @Post('send-bulk')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send bulk email notifications',
    description: 'Queue multiple emails for sending using background processing',
  })
  @ApiBody({ type: BulkEmailDto })
  @ApiResponse({
    status: 202,
    description: 'Bulk emails queued successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Bulk emails queued successfully' },
        count: { type: 'number', example: 25 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid bulk email data' })
  async sendBulkEmail(@Body() bulkEmailDto: BulkEmailDto) {
    await this.emailService.sendBulkEmail(bulkEmailDto);
    return {
      message: 'Bulk emails queued successfully',
      count: bulkEmailDto.recipients.length,
    };
  }

  @Get('queue/stats')
  @ApiOperation({
    summary: 'Get email queue statistics',
    description: 'Returns current email queue status and statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Email queue statistics',
    schema: {
      type: 'object',
      properties: {
        waiting: {
          type: 'number',
          description: 'Number of emails waiting to be sent',
        },
        active: {
          type: 'number',
          description: 'Number of emails currently being sent',
        },
        completed: {
          type: 'number',
          description: 'Number of emails sent successfully',
        },
        failed: {
          type: 'number',
          description: 'Number of emails that failed to send',
        },
      },
    },
  })
  async getQueueStats() {
    return await this.emailService.getQueueStats();
  }
}
