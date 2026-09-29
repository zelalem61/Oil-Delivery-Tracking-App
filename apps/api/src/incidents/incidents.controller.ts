import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateIncidentDto, ListIncidentsQuery, UpdateIncidentDto } from './incidents.dto';
import { IncidentsService } from './incidents.service';

type RequestUser = { user: { sub: string; role: string } };

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  /** Driver reports an incident on their own delivery. */
  @Post('deliveries/:id/incidents')
  @Roles('DRIVER')
  create(@Param('id') id: string, @Req() req: RequestUser, @Body() body: CreateIncidentDto) {
    return this.service.create(id, req.user.sub, body);
  }

  /** Admin sees all incidents; drivers see only their own. Default: open + acknowledged. */
  @Get('incidents')
  list(@Req() req: RequestUser, @Query() query: ListIncidentsQuery) {
    return this.service.list(req.user, query.status);
  }

  /** Admin acknowledges or resolves an incident. */
  @Patch('incidents/:id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Req() req: RequestUser, @Body() body: UpdateIncidentDto) {
    return this.service.update(id, req.user.sub, body);
  }
}
