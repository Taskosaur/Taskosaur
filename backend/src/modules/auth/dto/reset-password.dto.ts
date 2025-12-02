import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token received via email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description:
      'New password - must be at least 8 characters with uppercase, lowercase, and number',
    example: 'NewPassword123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  // @MinLength(8)
  /*@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })*/
  password: string;

  @ApiProperty({
    description: 'Confirm new password - must match the password field',
    example: 'NewPassword123',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
