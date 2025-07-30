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
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationMembersService } from './organization-members.service';
import {
  CreateOrganizationMemberDto,
  InviteOrganizationMemberDto,
} from './dto/create-organization-member.dto';
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('organization-members')
export class OrganizationMembersController {
  constructor(
    private readonly organizationMembersService: OrganizationMembersService,
  ) {}

  @Post()
  create(@Body() createOrganizationMemberDto: CreateOrganizationMemberDto) {
    return this.organizationMembersService.create(createOrganizationMemberDto);
  }

  @Post('invite')
  inviteByEmail(
    @Body() inviteOrganizationMemberDto: InviteOrganizationMemberDto,
  ) {
    return this.organizationMembersService.inviteByEmail(
      inviteOrganizationMemberDto,
    );
  }

  @Get()
  findAll(@Query('organizationId') organizationId?: string) {
    return this.organizationMembersService.findAll(organizationId);
  }

  @Get('user/:userId/organizations')
  getUserOrganizations(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.organizationMembersService.getUserOrganizations(userId);
  }

  @Get('organization/:organizationId/stats')
  getOrganizationStats(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.organizationMembersService.getOrganizationStats(organizationId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationMembersService.findOne(id);
  }

  @Get('user/:userId/organization/:organizationId')
  findByUserAndOrganization(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.organizationMembersService.findByUserAndOrganization(
      userId,
      organizationId,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationMemberDto: UpdateOrganizationMemberDto,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.organizationMembersService.update(
      id,
      updateOrganizationMemberDto,
      requestUserId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    // TODO: Get requestUserId from JWT token when authentication is implemented
    @Query('requestUserId') requestUserId: string,
  ) {
    return this.organizationMembersService.remove(id, requestUserId);
  }
}
