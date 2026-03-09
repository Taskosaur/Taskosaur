import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationMembersService } from './organization-members.service';
import {
  CreateOrganizationMemberDto,
  InviteOrganizationMemberDto,
} from './dto/create-organization-member.dto';
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto';
import { Scope } from 'src/common/decorator/scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  username: string;
}

@ApiTags('Organization Members')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('organization-members')
export class OrganizationMembersController {
  constructor(private readonly organizationMembersService: OrganizationMembersService) {}

  @Post()
  @ApiOperation({ summary: 'Add a member to an organization' })
  @ApiBody({ type: CreateOrganizationMemberDto })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  create(
    @Body() createOrganizationMemberDto: CreateOrganizationMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.create(createOrganizationMemberDto, user.id);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a user to organization by email' })
  @ApiBody({ type: InviteOrganizationMemberDto })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  inviteByEmail(
    @Body() inviteOrganizationMemberDto: InviteOrganizationMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.inviteByEmail(inviteOrganizationMemberDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organization members' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Filter by organization ID (UUID)',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search members by name or email' })
  @ApiResponse({ status: 200, description: 'List of organization members' })
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.organizationMembersService.findAll(organizationId, search, user?.id);
  }

  @Get('slug')
  @ApiOperation({ summary: 'Get organization members by organization slug' })
  @ApiQuery({ name: 'slug', required: false, description: 'Organization slug' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page' })
  @ApiQuery({ name: 'search', required: false, description: 'Search members by name or email' })
  @ApiResponse({ status: 200, description: 'Paginated list of organization members' })
  findAllByOrgSlug(
    @Query('slug') slug?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    return this.organizationMembersService.findAllByOrgSlug(
      slug,
      pageNum,
      limitNum,
      search,
      user?.id,
    );
  }

  @Patch('set-default')
  @ApiOperation({ summary: 'Set a default organization for a user' })
  setDefaultOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.organizationMembersService.setDefaultOrganizationByOrgAndUser(
      organizationId,
      user.id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization member role' })
  @ApiParam({ name: 'id', description: 'Organization member ID (UUID)' })
  @ApiBody({ type: UpdateOrganizationMemberDto })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Organization member not found' })
  @Scope('ORGANIZATION', 'id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationMemberDto: UpdateOrganizationMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.update(id, updateOrganizationMemberDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from organization' })
  @ApiParam({ name: 'id', description: 'Organization member ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 404, description: 'Organization member not found' })
  @Scope('ORGANIZATION', 'id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationMembersService.remove(id, user.id);
  }

  @Get('user/:userId/organizations')
  @ApiOperation({ summary: 'Get all organizations for a user' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of organizations the user belongs to' })
  @Scope('ORGANIZATION', 'id')
  getUserOrganizations(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.getUserOrganizations(userId, user.id);
  }

  @Get('organization/:organizationId/stats')
  @ApiOperation({ summary: 'Get organization member statistics' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Organization member statistics' })
  getOrganizationStats(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.getOrganizationStats(organizationId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization member by ID' })
  @ApiParam({ name: 'id', description: 'Organization member ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Organization member details' })
  @ApiResponse({ status: 404, description: 'Organization member not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationMembersService.findOne(id, user.id);
  }

  @Get('user/:userId/organization/:organizationId')
  @ApiOperation({ summary: 'Get membership for a specific user and organization' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiParam({ name: 'organizationId', description: 'Organization ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Organization membership details' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  findByUserAndOrganization(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.findByUserAndOrganization(
      userId,
      organizationId,
      user.id,
    );
  }
}
