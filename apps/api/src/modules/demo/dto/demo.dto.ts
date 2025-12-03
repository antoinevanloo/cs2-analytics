/**
 * Demo DTOs - Data Transfer Objects for demo endpoints
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from "class-validator";

export class UploadDemoDto {
  @ApiProperty({ description: "Demo filename" })
  @IsString()
  filename!: string;

  @ApiPropertyOptional({ description: "Demo file URL (for remote upload)" })
  @IsString()
  @IsOptional()
  url?: string;
}

export class ParseOptionsDto {
  @ApiPropertyOptional({
    description: "Extract tick-by-tick data",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  extractTicks?: boolean = true;

  @ApiPropertyOptional({
    description: "Tick sampling interval (1 = every tick)",
    default: 1,
    minimum: 1,
    maximum: 128,
  })
  @IsNumber()
  @Min(1)
  @Max(128)
  @IsOptional()
  tickInterval?: number = 1;

  @ApiPropertyOptional({
    description: "Extract grenade trajectories and data",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  extractGrenades?: boolean = true;

  @ApiPropertyOptional({
    description: "Extract chat messages",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  extractChat?: boolean = true;

  @ApiPropertyOptional({
    description: "Specific events to extract (null = essential events)",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @ApiPropertyOptional({
    description: "Specific player properties to extract (null = high frequency)",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  properties?: string[];
}

export class DemoFiltersDto {
  @ApiPropertyOptional({ description: "Filter by map name" })
  @IsString()
  @IsOptional()
  map?: string;

  @ApiPropertyOptional({ description: "Filter by game mode" })
  @IsString()
  @IsOptional()
  gameMode?: string;

  @ApiPropertyOptional({ description: "Filter by player Steam ID" })
  @IsString()
  @IsOptional()
  playerId?: string;
}

export class PaginationDto {
  @ApiPropertyOptional({ description: "Page number", default: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class TickQueryDto {
  @ApiPropertyOptional({ description: "Start tick" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  startTick?: number;

  @ApiPropertyOptional({ description: "End tick" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  endTick?: number;

  @ApiPropertyOptional({
    description: "Sampling interval",
    default: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  interval?: number = 1;

  @ApiPropertyOptional({
    description: "Filter by player Steam IDs",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  players?: string[];
}

export class EventQueryDto {
  @ApiPropertyOptional({ description: "Filter by event type" })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: "Filter by round number" })
  @IsNumber()
  @Min(1)
  @IsOptional()
  round?: number;

  @ApiPropertyOptional({ description: "Filter by player Steam ID" })
  @IsString()
  @IsOptional()
  playerId?: string;

  @ApiPropertyOptional({ description: "Start tick" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  startTick?: number;

  @ApiPropertyOptional({ description: "End tick" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  endTick?: number;
}
