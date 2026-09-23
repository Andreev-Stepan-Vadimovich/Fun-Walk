import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { RoutePlannerService } from './planner/route-planner.service';
import { OsrmRoutingService } from './planner/routing/osrm-routing.service';
import { StreetGraphService } from './planner/graph/street-graph.service';
import { PoiGraphService } from './planner/graph/poi-graph.service';
import { AqiService } from './planner/aqi/aqi.service';
import { OsmPoiService } from './planner/poi/osm-poi.service';

@Module({
  controllers: [RoutesController],
  providers: [
    RoutesService,
    RoutePlannerService,
    OsrmRoutingService,
    StreetGraphService,
    PoiGraphService,
    AqiService,
    OsmPoiService,
  ],
})
export class RoutesModule {}
