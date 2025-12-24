import { Controller, Post, Body, UseGuards, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import {
  ChatRequestDto,
  ChatResponseDto,
  TestConnectionDto,
  TestConnectionResponseDto,
} from './dto/chat.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('AI Chat')
@Controller('ai-chat')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send chat message to AI assistant' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(
    @CurrentUser() user: User,
    @Body() chatRequest: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    return this.aiChatService.chat(chatRequest, user.id);
  }

  @Post('test-connection')
  @ApiOperation({ summary: 'Test AI provider connection without requiring AI to be enabled' })
  @ApiResponse({ status: 200, type: TestConnectionResponseDto })
  async testConnection(
    @Body() testConnectionDto: TestConnectionDto,
  ): Promise<TestConnectionResponseDto> {
    return this.aiChatService.testConnection(testConnectionDto);
  }

  @Delete('context/:sessionId')
  @ApiOperation({ summary: 'Clear conversation context for a session' })
  @ApiResponse({ status: 200, description: 'Context cleared successfully' })
  clearContext(@Param('sessionId') sessionId: string): { success: boolean } {
    return this.aiChatService.clearContext(sessionId);
  }
}
