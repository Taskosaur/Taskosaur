import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmailReplyService } from '../services/email-reply.service';

@ApiTags('Task Comments - Email Integration')
@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaskCommentEmailController {
  constructor(private emailReply: EmailReplyService) {}

  @Post(':commentId/send-email')
  @ApiOperation({
    summary: 'Send comment as email reply',
    description: 'Sends a task comment as an email reply to the original email thread',
  })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comment sent as email successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        messageId: { type: 'string' },
        recipients: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Comment cannot be sent as email (already sent, no email thread, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Comment or task not found',
  })
  async sendCommentAsEmail(@Param('taskId') taskId: string, @Param('commentId') commentId: string) {
    try {
      const result = await this.emailReply.sendCommentAsEmail(commentId);
      return {
        message: 'Comment sent as email successfully',
        ...result,
      };
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) {
        throw new BadRequestException(errorMessage);
      }
      throw new BadRequestException(`Failed to send email: ${errorMessage}`);
    }
  }
}
