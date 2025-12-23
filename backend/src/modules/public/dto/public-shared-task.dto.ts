import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min, Max } from 'class-validator';

export class CreatePublicTaskShareDto {
  @ApiProperty({ description: 'Task ID to share' })
  @IsUUID()
  taskId: string;

  @ApiProperty({
    description: 'Expiry time in days',
    enum: [1, 3, 7, 14, 30],
    example: 7,
  })
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays: number;
}

export class PublicTaskShareResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  token: string;

  @ApiProperty()
  shareUrl: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  createdAt: Date;
}

export class PublicSharedTaskDto {
  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  status: {
    name: string;
    color: string;
  };

  @ApiProperty()
  priority: string;

  @ApiProperty({ required: false })
  dueDate?: Date;

  @ApiProperty({ type: 'array' })
  assignees: Array<{
    firstName: string;
    lastName: string;
  }>;

  @ApiProperty({ type: 'array' })
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
}
