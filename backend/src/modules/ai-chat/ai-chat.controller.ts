import { Controller, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@ApiTags('AI Chat')
@Controller('ai-chat')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send chat message to AI assistant' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    return this.aiChatService.chat(chatRequest);
  }

  @Delete('context/:sessionId')
  @ApiOperation({ summary: 'Clear conversation context for a session' })
  @ApiResponse({ status: 200, description: 'Context cleared successfully' })
  clearContext(@Param('sessionId') sessionId: string): { success: boolean } {
    return this.aiChatService.clearContext(sessionId);
  }
}
