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
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('organization-members')
export class OrganizationMembersController {
  constructor(private readonly organizationMembersService: OrganizationMembersService) {}

  @Post()
  create(
    @Body() createOrganizationMemberDto: CreateOrganizationMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.create(createOrganizationMemberDto, user.id);
  }

  @Post('invite')
  inviteByEmail(
    @Body() inviteOrganizationMemberDto: InviteOrganizationMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.inviteByEmail(inviteOrganizationMemberDto, user.id);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.organizationMembersService.findAll(organizationId, search, user?.id);
  }

  @Get('slug')
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
  @Scope('ORGANIZATION', 'id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationMembersService.remove(id, user.id);
  }

  @Get('user/:userId/organizations')
  @Scope('ORGANIZATION', 'id')
  getUserOrganizations(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.getUserOrganizations(userId, user.id);
  }

  @Get('organization/:organizationId/stats')
  getOrganizationStats(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationMembersService.getOrganizationStats(organizationId, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationMembersService.findOne(id, user.id);
  }

  @Get('user/:userId/organization/:organizationId')
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
