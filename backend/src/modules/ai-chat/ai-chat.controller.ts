// Trigger watch reload
import { Controller, Post, Body, UseGuards, Delete, Param, Get, Patch, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import {
  ChatRequestDto,
  ChatResponseDto,
  TestConnectionDto,
  TestConnectionResponseDto,
  GenerateDescriptionDto,
  GenerateDescriptionResponseDto,
  CreateConversationDto,
  RenameConversationDto,
  UpdateMessagesDto,
} from './dto/chat.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('AI Chat')
@Controller('ai-chat')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all AI conversations' })
  @ApiResponse({ status: 200 })
  async getConversations(@CurrentUser() user: User) {
    return this.aiChatService.getConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new AI conversation' })
  @ApiResponse({ status: 201 })
  async createConversation(@CurrentUser() user: User, @Body() dto: CreateConversationDto) {
    return this.aiChatService.createConversation(user.id, dto);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename an AI conversation' })
  @ApiResponse({ status: 200 })
  async renameConversation(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RenameConversationDto,
  ) {
    return this.aiChatService.renameConversation(user.id, id, dto);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete an AI conversation' })
  @ApiResponse({ status: 200 })
  async deleteConversation(@CurrentUser() user: User, @Param('id') id: string) {
    return this.aiChatService.deleteConversation(user.id, id);
  }

  @Put('conversations/:id/messages')
  @ApiOperation({ summary: 'Update conversation messages' })
  @ApiResponse({ status: 200 })
  async updateMessages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMessagesDto,
  ) {
    return this.aiChatService.updateMessages(user.id, id, dto);
  }

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

  @Post('generate-description')
  @ApiOperation({ summary: 'Generate a task description from a title using AI' })
  @ApiResponse({ status: 200, type: GenerateDescriptionResponseDto })
  async generateDescription(
    @CurrentUser() user: User,
    @Body() dto: GenerateDescriptionDto,
  ): Promise<GenerateDescriptionResponseDto> {
    return this.aiChatService.generateDescription(dto, user.id);
  }

  @Delete('context/:sessionId')
  @ApiOperation({ summary: 'Clear conversation context for a session' })
  @ApiResponse({ status: 200, description: 'Context cleared successfully' })
  async clearContext(
    @CurrentUser() user: User,
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean }> {
    return this.aiChatService.clearContext(user.id, sessionId);
  }
}
