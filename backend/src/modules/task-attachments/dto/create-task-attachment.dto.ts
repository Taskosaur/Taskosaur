import { IsString, IsNotEmpty, IsInt, IsPositive, IsUUID } from 'class-validator';

export class CreateTaskAttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsInt()
  @IsPositive()
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsUUID()
  @IsNotEmpty()
  taskId: string;
}

export class UploadTaskAttachmentDto {
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @IsUUID()
  @IsNotEmpty()
  uploadedBy: string;
}
