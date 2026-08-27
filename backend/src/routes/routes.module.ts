import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { RoutePlannerService } from './planner/route-planner.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, RoutePlannerService],
})
export class RoutesModule {}
