
import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { AppService } from './app.service.js';
import { TelemetryDto } from './dto/telemetry.dto.js';

@Controller('telemetry')
export class AppController {
  constructor(
    private readonly appService: AppService,
  ) {}

  @Post()
  async receiveTelemetry(
    @Body() payload: TelemetryDto,
  ) {
    return this.appService.processTelemetry(payload);
  }
}
