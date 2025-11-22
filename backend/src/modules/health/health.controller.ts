import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService, HealthStatus } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async getHealth(@Res() res: Response): Promise<Response> {
    const health: HealthStatus = await this.healthService.checkHealth();
    return res.status(HttpStatus.OK).json(health);
  }
}
