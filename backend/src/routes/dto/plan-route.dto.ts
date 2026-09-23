import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LatLngDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class RoutePreferencesDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  nature!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  bikePaths!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  airQuality!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  quietAreas!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  waterfront!: number;
}

export class PlanRouteDto {
  @ValidateNested()
  @Type(() => LatLngDto)
  start!: LatLngDto;

  @ValidateNested()
  @Type(() => LatLngDto)
  end!: LatLngDto;

  @ValidateNested()
  @Type(() => RoutePreferencesDto)
  preferences!: RoutePreferencesDto;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['quick', 'waterfront', 'romantic', 'green', 'bike', 'peaceful', 'custom'])
  presetId?: string;
}
