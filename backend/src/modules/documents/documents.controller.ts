import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  Matches,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorator/roles.decorator';
import { Scope } from '../../common/decorator/scope.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentScope, DocumentsService, DocumentsUser } from './documents.service';
class DocumentOwnerParams {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() workspaceId?: string;
  @IsOptional() @IsUUID() organizationId?: string;
}
class DocumentQuery {
  @IsString() @MaxLength(500) path: string;
}
class SearchQuery {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
}
class SourcesQuery extends SearchQuery {
  @IsOptional() @IsIn(['true', 'false']) includeChildren?: string;
}
class CreateDocumentDto extends DocumentQuery {
  @IsString() @MaxLength(200) @Matches(/^(?=.*\S)[^\r\n\u2028\u2029]+$/) title: string;
}
class SaveDocumentDto extends DocumentQuery {
  @IsString() @MaxLength(204800) content: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) revision: string;
}
class DocumentReferenceDto {
  @IsIn(['organization', 'workspace', 'project']) scope: DocumentScope;
  @IsUUID() ownerId: string;
  @IsString() @MaxLength(500) path: string;
}
class DocumentLinksDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  paths?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DocumentReferenceDto)
  references?: DocumentReferenceDto[];
}
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
abstract class ScopedDocumentsController {
  protected abstract readonly scope: DocumentScope;
  constructor(private readonly documents: DocumentsService) {}
  private ownerId(params: DocumentOwnerParams): string {
    return params[`${this.scope}Id`]!;
  }
  @Get('documents')
  @Roles(Role.VIEWER)
  list(@Param() params: DocumentOwnerParams, @Query() query: SearchQuery) {
    return this.documents.list(this.ownerId(params), query.q, this.scope);
  }
  @Get('document-sources')
  @Roles(Role.VIEWER)
  sources(
    @Param() params: DocumentOwnerParams,
    @Query() query: SourcesQuery,
    @Req() request: { user: DocumentsUser },
  ) {
    return this.documents.listSources(
      this.scope,
      this.ownerId(params),
      request.user,
      query.q,
      query.includeChildren === 'true',
    );
  }
  @Get('document')
  @Roles(Role.VIEWER)
  read(
    @Param() params: DocumentOwnerParams,
    @Query() query: DocumentQuery,
    @Req() request: { user: DocumentsUser },
  ) {
    return this.documents.read(this.ownerId(params), query.path, this.scope, request.user);
  }
  @Post('document')
  @Roles(Role.MEMBER)
  create(@Param() params: DocumentOwnerParams, @Body() body: CreateDocumentDto) {
    return this.documents.create(this.ownerId(params), body.path, body.title, this.scope);
  }
  @Put('document')
  @Roles(Role.MEMBER)
  save(
    @Param() params: DocumentOwnerParams,
    @Body() body: SaveDocumentDto,
    @Req() request: { user: DocumentsUser },
  ) {
    return this.documents.save(
      this.ownerId(params),
      body.path,
      body.content,
      body.revision,
      this.scope,
      request.user,
    );
  }
}
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Scope('PROJECT', 'projectId')
export class DocumentsController extends ScopedDocumentsController {
  protected readonly scope = 'project';
  constructor(private readonly projectDocuments: DocumentsService) {
    super(projectDocuments);
  }
  @Get('tasks/:taskId/document-links')
  @Roles(Role.VIEWER)
  links(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() request: { user: DocumentsUser },
  ) {
    return this.projectDocuments.links(projectId, taskId, request.user);
  }
  @Put('tasks/:taskId/document-links')
  @Roles(Role.MEMBER)
  saveLinks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: DocumentLinksDto,
    @Req() request: { user: DocumentsUser },
  ) {
    if ((body.paths !== undefined) === (body.references !== undefined))
      throw new BadRequestException('Provide exactly one of paths or references');
    return body.paths !== undefined
      ? this.projectDocuments.saveLinks(projectId, taskId, body.paths, request.user)
      : this.projectDocuments.saveReferences(projectId, taskId, body.references!, request.user);
  }
}
@Controller('organizations/:organizationId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Scope('ORGANIZATION', 'organizationId')
export class OrganizationDocumentsController extends ScopedDocumentsController {
  protected readonly scope = 'organization';
}
@Controller('workspaces/:workspaceId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Scope('WORKSPACE', 'workspaceId')
export class WorkspaceDocumentsController extends ScopedDocumentsController {
  protected readonly scope = 'workspace';
}
