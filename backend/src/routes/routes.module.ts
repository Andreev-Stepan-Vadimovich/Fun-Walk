import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { RoutePlannerService } from './planner/route-planner.service';
import { OsrmRoutingService } from './planner/routing/osrm-routing.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, RoutePlannerService, OsrmRoutingService],
})
export class RoutesModule {}
