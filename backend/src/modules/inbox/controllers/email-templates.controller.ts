import { Controller, Get, Query, Param, UseGuards, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmailTemplatesService } from '../../../seeder/email-templates.service';

@ApiTags('Email Templates')
@Controller('email-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailTemplatesController {
  constructor(private emailTemplatesService: EmailTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all default email templates' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'search', required: false, description: 'Search templates' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email templates retrieved successfully' })
  getTemplates(@Query('category') category?: string, @Query('search') search?: string) {
    if (search) {
      return this.emailTemplatesService.searchTemplates(search);
    }

    if (category) {
      return this.emailTemplatesService.getTemplatesByCategory(category);
    }

    return this.emailTemplatesService.getDefaultTemplates();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get template categories' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Template categories retrieved successfully' })
  getCategories() {
    return this.emailTemplatesService.getTemplateCategories();
  }

  @Get('variables')
  @ApiOperation({ summary: 'Get common template variables' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Template variables retrieved successfully' })
  getVariables() {
    return this.emailTemplatesService.getCommonVariables();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Template retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Template not found' })
  getTemplate(@Param('id') id: string) {
    const template = this.emailTemplatesService.getTemplateById(id);
    if (!template) {
      return { error: 'Template not found' };
    }
    return template;
  }
}
