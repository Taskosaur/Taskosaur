import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  ForbiddenException,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStatusService } from './services/user-status.service';
import { UserStatusResponseDto, BulkUserStatusResponseDto } from './dto/user-status.dto';

/**
 * Fields of a user record that describe the account's standing rather than the
 * person's profile. An administrator decides each of them, so the account owner
 * may not set them on themselves through the ordinary self-update route:
 * `status` gates password login, `role` carries privilege, and `emailVerified`
 * asserts an ownership check the user has not actually passed.
 */
const PRIVILEGED_SELF_UPDATE_FIELDS = ['role', 'status', 'emailVerified'] as const;

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userStatusService: UserStatusService,
  ) {}

  @Public()
  @Get('exists')
  @ApiOperation({ summary: 'Check if any users exist in the system' })
  @ApiResponse({
    status: 200,
    description: 'Returns whether any users exist',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
      },
    },
  })
  async checkUsersExist() {
    const exists = await this.usersService.checkUsersExist();
    return { exists };
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully.',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({
    status: 409,
    description: 'Email or username already exists.',
  })
  @ApiBody({ type: CreateUserDto })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retrieve all users' })
  @ApiResponse({ status: 200, description: 'List of all users.', type: [User] })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'User details.', type: User })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const requestUser = req.user;
    if (requestUser.role !== Role.SUPER_ADMIN && requestUser.id !== id) {
      throw new ForbiddenException('Profile access not allowed');
    }
    return this.usersService.findOne(id);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Retrieve public user profile for shared organization members' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Public User Profile details.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Must share an organization.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getPublicProfile(@Param('id') id: string, @Req() req: any) {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new BadRequestException('Invalid identifier format');
    }
    return this.usersService.getPublicProfile(id, String(req.user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)', type: String })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully.',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({
    status: 409,
    description: 'Email or username already exists.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    const requestUser = req.user;
    const isSuperAdmin = requestUser.role === Role.SUPER_ADMIN;

    // 1. If not SUPER_ADMIN and not Self -> Forbidden
    if (!isSuperAdmin && requestUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // 2. Self-service edits the profile, never the account's standing in the
    // system. Each field below is decided elsewhere by an administrator, and
    // letting the account owner set it here would let them undo that decision:
    // `status` gates password login, `role` grants privilege, and
    // `emailVerified` asserts an ownership check the user has not passed.
    // Rejecting rather than silently dropping them keeps the refusal visible.
    if (!isSuperAdmin) {
      const attempted = PRIVILEGED_SELF_UPDATE_FIELDS.filter(
        (field) => updateUserDto[field] !== undefined,
      );
      if (attempted.length > 0) {
        throw new ForbiddenException(
          `You cannot change your own ${attempted.join(', ')}. ` +
            'An administrator manages these fields.',
        );
      }
    }

    return this.usersService.update(id, updateUserDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password changed successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Password validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.changePassword(req.user.id as string, changePasswordDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)', type: String })
  @ApiResponse({ status: 204, description: 'User deleted successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get online status for a single user' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)', type: String })
  @ApiResponse({
    status: 200,
    description: 'User online status',
    type: UserStatusResponseDto,
  })
  async getUserStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.userStatusService.getUserStatus(id);
  }

  @Get('status/bulk')
  @ApiOperation({ summary: 'Get online status for multiple users' })
  @ApiQuery({
    name: 'userIds',
    description: 'Comma-separated list of user IDs',
    example: 'uuid1,uuid2,uuid3',
  })
  @ApiResponse({
    status: 200,
    description: 'Map of user statuses',
    type: BulkUserStatusResponseDto,
  })
  async getUsersStatus(@Query('userIds') userIds: string) {
    const ids = userIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const statusMap = await this.userStatusService.getUsersStatus(ids);
    const status: Record<string, { isOnline: boolean; lastSeen?: string }> = {};
    statusMap.forEach((value, key) => {
      status[key] = { isOnline: value.isOnline, lastSeen: value.lastSeen };
    });
    return { status };
  }
}
