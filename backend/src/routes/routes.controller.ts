import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
  getPointsOfInterest() {
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
