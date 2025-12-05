/**
 * Replay Controller
 *
 * REST API endpoints for 2D replay functionality.
 *
 * Endpoints:
 * - GET /v1/replay/:demoId/rounds              - List rounds metadata
 * - GET /v1/replay/:demoId/round/:roundNumber  - Get full round replay
 * - GET /v1/replay/:demoId/round/:roundNumber/stream - Stream replay (NDJSON)
 * - GET /v1/replay/map/:mapName                - Get map radar config
 * - GET /v1/replay/:demoId/available           - Check if tick data exists
 *
 * @module replay
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Logger,
  NotFoundException,
  ParseIntPipe,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiProduces,
} from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import { ReplayService } from "./replay.service";
import type {
  RoundReplayData,
  RoundMetadata,
  MapRadarConfig,
} from "./types/replay.types";

@ApiTags("2D Replay")
@Controller("v1/replay")
export class ReplayController {
  private readonly logger = new Logger(ReplayController.name);

  constructor(private readonly replayService: ReplayService) {}

  /**
   * Get all rounds metadata for a demo
   */
  @Get(":demoId/rounds")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get rounds metadata for replay" })
  @ApiParam({ name: "demoId", description: "Demo ID" })
  @ApiResponse({ status: 200, description: "Rounds metadata" })
  @ApiResponse({ status: 404, description: "Demo not found" })
  async getDemoRounds(
    @Param("demoId") demoId: string,
  ): Promise<RoundMetadata[]> {
    return this.replayService.getDemoRoundsMetadata(demoId);
  }

  /**
   * Get complete replay data for a round
   */
  @Get(":demoId/round/:roundNumber")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get full round replay data" })
  @ApiParam({ name: "demoId", description: "Demo ID" })
  @ApiParam({ name: "roundNumber", description: "Round number (1-based)" })
  @ApiQuery({
    name: "includeEvents",
    required: false,
    description: "Include kill/grenade events (default: true)",
  })
  @ApiQuery({
    name: "sampleInterval",
    required: false,
    description: "Tick sampling interval (default: 8)",
  })
  @ApiResponse({ status: 200, description: "Round replay data" })
  @ApiResponse({ status: 404, description: "Round not found" })
  async getRoundReplay(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
    @Query("includeEvents") includeEvents?: string,
    @Query("sampleInterval") sampleInterval?: string,
  ): Promise<RoundReplayData> {
    const options: { includeEvents?: boolean; sampleInterval?: number } = {
      includeEvents: includeEvents !== "false",
    };
    if (sampleInterval) {
      options.sampleInterval = parseInt(sampleInterval, 10);
    }
    return this.replayService.getRoundReplay(demoId, roundNumber, options);
  }

  /**
   * Stream round replay data as NDJSON
   *
   * Format: Each line is a JSON object with one of:
   * - { type: "metadata", data: {...} }
   * - { type: "frame", data: TickFrame }
   * - { type: "event", data: ReplayEvent }
   * - { type: "end", data: { framesStreamed, eventsStreamed } }
   */
  @Get(":demoId/round/:roundNumber/stream")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Stream round replay as NDJSON" })
  @ApiParam({ name: "demoId", description: "Demo ID" })
  @ApiParam({ name: "roundNumber", description: "Round number (1-based)" })
  @ApiQuery({
    name: "sampleInterval",
    required: false,
    description: "Tick sampling interval (default: 8)",
  })
  @ApiQuery({
    name: "batchSize",
    required: false,
    description: "Frames per batch (default: 100)",
  })
  @ApiProduces("application/x-ndjson")
  @ApiResponse({
    status: 200,
    description: "NDJSON stream of replay data",
    content: {
      "application/x-ndjson": {
        schema: {
          type: "string",
          description: "Newline-delimited JSON objects",
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Round not found" })
  async streamRoundReplay(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
    @Query("sampleInterval") sampleInterval: string | undefined,
    @Query("batchSize") batchSize: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Set headers for streaming NDJSON
    reply.raw.writeHead(HttpStatus.OK, {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    try {
      const streamOptions: { sampleInterval?: number; batchSize?: number } = {};
      if (sampleInterval)
        streamOptions.sampleInterval = parseInt(sampleInterval, 10);
      if (batchSize) streamOptions.batchSize = parseInt(batchSize, 10);

      const stream = this.replayService.streamRoundReplay(
        demoId,
        roundNumber,
        streamOptions,
      );

      for await (const item of stream) {
        // Wrap frames and events with type markers
        const message =
          "tick" in item
            ? { type: "frame", data: item }
            : "type" in item && item.type
              ? item
              : { type: "event", data: item };

        reply.raw.write(JSON.stringify(message) + "\n");
      }

      reply.raw.end();
    } catch (error) {
      this.logger.error(`Stream error: ${error}`);

      if (error instanceof NotFoundException) {
        // Write error as NDJSON
        reply.raw.write(
          JSON.stringify({
            type: "error",
            data: { message: error.message, code: "NOT_FOUND" },
          }) + "\n",
        );
      } else {
        reply.raw.write(
          JSON.stringify({
            type: "error",
            data: { message: "Stream error", code: "INTERNAL_ERROR" },
          }) + "\n",
        );
      }

      reply.raw.end();
    }
  }

  /**
   * Get map radar configuration
   */
  @Get("map/:mapName")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get map radar configuration" })
  @ApiParam({ name: "mapName", description: "Map name (e.g., de_dust2)" })
  @ApiResponse({ status: 200, description: "Map radar config" })
  @ApiResponse({ status: 404, description: "Map not found" })
  async getMapMetadata(
    @Param("mapName") mapName: string,
  ): Promise<MapRadarConfig> {
    const config = await this.replayService.getMapMetadata(mapName);

    if (!config) {
      throw new NotFoundException(`Map ${mapName} not found`);
    }

    return config;
  }

  /**
   * Check if tick data is available for a demo
   */
  @Get(":demoId/available")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Check if replay data is available" })
  @ApiParam({ name: "demoId", description: "Demo ID" })
  @ApiResponse({ status: 200, description: "Availability status" })
  async checkAvailability(
    @Param("demoId") demoId: string,
  ): Promise<{ available: boolean; tickDataExists: boolean }> {
    const tickDataExists = await this.replayService.hasTickData(demoId);

    return {
      available: tickDataExists,
      tickDataExists,
    };
  }

  /**
   * Get all available maps with radar configurations
   */
  @Get("maps")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all available map configurations" })
  @ApiResponse({ status: 200, description: "List of map configurations" })
  async getAllMaps(): Promise<MapRadarConfig[]> {
    // Note: This would need a method in ReplayService to get all maps
    // For now, we'll use a direct prisma query
    const maps = await this.replayService["prisma"].mapMetadata.findMany({
      orderBy: { mapName: "asc" },
    });

    return maps.map((m) => {
      const config: MapRadarConfig = {
        mapName: m.mapName,
        posX: m.posX,
        posY: m.posY,
        scale: m.scale,
        radarWidth: m.radarWidth,
        radarHeight: m.radarHeight,
        hasLowerLevel: m.hasLowerLevel,
      };

      if (m.displayName) config.displayName = m.displayName;
      if (m.lowerPosX !== null) config.lowerPosX = m.lowerPosX;
      if (m.lowerPosY !== null) config.lowerPosY = m.lowerPosY;
      if (m.lowerScale !== null) config.lowerScale = m.lowerScale;
      if (m.splitAltitude !== null) config.splitAltitude = m.splitAltitude;

      return config;
    });
  }
}
