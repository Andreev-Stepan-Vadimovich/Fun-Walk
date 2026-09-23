import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { PlanRouteDto } from './dto/plan-route.dto';

@Controller('api')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'fun-walk-api' };
  }

  @Get('poi')
  getPointsOfInterest(
    @Query('startLat') startLat?: string,
    @Query('startLng') startLng?: string,
    @Query('endLat') endLat?: string,
    @Query('endLng') endLng?: string,
  ) {
    const start =
      startLat && startLng
        ? { lat: Number(startLat), lng: Number(startLng) }
        : null;
    const end =
      endLat && endLng ? { lat: Number(endLat), lng: Number(endLng) } : null;

    if (
      start &&
      end &&
      Number.isFinite(start.lat) &&
      Number.isFinite(start.lng) &&
      Number.isFinite(end.lat) &&
      Number.isFinite(end.lng)
    ) {
      return this.routesService.getPointsOfInterestNear(start, end);
    }

    return this.routesService.getPointsOfInterest();
  }

  @Get('defaults')
  getDefaults() {
    return this.routesService.getDefaultPoints();
  }

  @Get('routes')
  findAll() {
    return this.routesService.findAll();
  }

  @Get('routes/:id')
  findOne(@Param('id') id: string) {
    return this.routesService.findOne(id);
  }

  @Post('routes/plan')
  planRoute(@Body() dto: PlanRouteDto) {
    return this.routesService.planRoute(dto);
  }

  @Delete('routes/:id')
  remove(@Param('id') id: string) {
    this.routesService.remove(id);
    return { deleted: true };
  }
}
