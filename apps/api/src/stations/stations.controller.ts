import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateStationDto,
  HistoryQuery,
  StationFuelDto,
  SubmitSalesReportDto,
  UpdateStationDto,
} from './stations.dto';
import { StationsService, type RequestUser } from './stations.service';

type Request = { user: RequestUser };

@ApiTags('stations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stations')
export class StationsController {
  constructor(private readonly service: StationsService) {}

  /** Admin and operations managers: every station. Station managers: their own. */
  @Get()
  @Roles('ADMIN', 'OPERATIONS_MANAGER', 'STATION_MANAGER')
  list(@Req() req: Request) {
    return this.service.list(req.user);
  }

  /** Active stations and their fuels, for picking a delivery destination. */
  @Get('options')
  options() {
    return this.service.options();
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATIONS_MANAGER', 'STATION_MANAGER')
  get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(req.user, id);
  }

  @Get(':id/history')
  @Roles('ADMIN', 'OPERATIONS_MANAGER', 'STATION_MANAGER')
  history(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: HistoryQuery,
  ) {
    return this.service.history(req.user, id, query);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() body: CreateStationDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateStationDto) {
    return this.service.update(id, body);
  }

  /** Add a fuel to a station, or record a new opening stock after a physical count. */
  @Put(':id/fuels')
  @Roles('ADMIN')
  upsertFuel(@Param('id', ParseUUIDPipe) id: string, @Body() body: StationFuelDto) {
    return this.service.upsertFuel(id, body);
  }

  /** Submit or correct the daily sales report for a date (YYYY-MM-DD). */
  @Put(':id/reports/:date')
  @Roles('ADMIN', 'STATION_MANAGER')
  submitReport(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Body() body: SubmitSalesReportDto,
  ) {
    return this.service.submitReport(req.user, id, date, body);
  }
}
