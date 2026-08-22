import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeliveryStatus } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateDeliveryDto,
  CreateDeliveryLocationDto,
  UpdateDeliveryStatusDto,
} from './deliveries.dto';
import { DeliveriesService } from './deliveries.service';

type RequestUser = { user: { sub: string; role: string } };

@ApiTags('deliveries')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService) {}

  @Get()
  list(@Req() req: RequestUser) {
    return this.service.list(req.user);
  }

  @Post()
  @Roles('DRIVER')
  create(@Req() req: RequestUser, @Body() body: CreateDeliveryDto) {
    return this.service.create(req.user.sub, body);
  }

  @Post(':id/locations')
  @Roles('DRIVER')
  location(
    @Param('id') id: string,
    @Req() req: RequestUser,
    @Body() body: CreateDeliveryLocationDto,
  ) {
    return this.service.addLocation(id, req.user.sub, body);
  }

  @Patch(':id/status')
  @Roles('DRIVER')
  status(@Param('id') id: string, @Req() req: RequestUser, @Body() body: UpdateDeliveryStatusDto) {
    return this.service.updateByDriver(id, req.user.sub, body.status as DeliveryStatus);
  }

  @Post(':id/approve-delivered')
  @Roles('ADMIN')
  approve(@Param('id') id: string, @Req() req: RequestUser) {
    return this.service.approveDelivered(id, req.user.sub);
  }
}
