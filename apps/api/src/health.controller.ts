import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get() @ApiOperation({ summary: 'Service health check' }) check() {
    return {
      success: true,
      data: { status: 'ok', service: 'fueltrack-api', timestamp: new Date().toISOString() },
    };
  }
}
