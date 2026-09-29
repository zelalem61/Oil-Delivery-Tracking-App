import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateMaintenanceDto, ListMaintenanceQuery, ReviewMaintenanceDto } from './maintenance.dto';
import {
  allowedMimeTypes,
  MAX_FILE_BYTES,
  MAX_FILES,
  MaintenanceService,
  type UploadedFileLike,
} from './maintenance.service';

type RequestUser = { user: { sub: string; role: string } };

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  /** Driver adds a garage record; multipart/form-data with optional `files`. */
  @Post()
  @Roles('DRIVER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
      fileFilter: (_req, file, callback) => {
        if (allowedMimeTypes.includes(file.mimetype)) callback(null, true);
        else
          callback(
            new BadRequestException(
              `${file.originalname}: only photos, PDF, Word or Excel files can be attached`,
            ),
            false,
          );
      },
    }),
  )
  create(
    @Req() req: RequestUser,
    @Body() body: CreateMaintenanceDto,
    @UploadedFiles() files: UploadedFileLike[] | undefined,
  ) {
    return this.service.create(req.user.sub, body, files ?? []);
  }

  /** Admin: every record, with filters and totals. Driver: own records. */
  @Get()
  list(@Req() req: RequestUser, @Query() query: ListMaintenanceQuery) {
    return this.service.list(req.user, query);
  }

  @Get('attachments/:attachmentId')
  async attachment(
    @Req() req: RequestUser,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    const file = await this.service.attachment(attachmentId, req.user);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.sizeBytes,
      disposition: `inline; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Get(':id')
  async get(@Req() req: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.service.get(id, req.user) };
  }

  @Patch(':id/review')
  @Roles('ADMIN')
  review(
    @Req() req: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewMaintenanceDto,
  ) {
    return this.service.review(id, req.user.sub, body);
  }
}
