import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateDriverDto } from './drivers.dto';
import { DriversService } from './drivers.service';
@ApiTags('drivers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('drivers')
export class DriversController {
  constructor(private readonly service: DriversService) {}
  @Get() list() {
    return this.service.list();
  }
  @Get('directory') directory(@Query('search') search?: string, @Query('page') page?: string) {
    return this.service.directory(search, page);
  }
  @Post() create(@Body() body: CreateDriverDto) {
    return this.service.create(body);
  }
}
