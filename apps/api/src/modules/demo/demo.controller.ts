/**
 * Demo Controller - REST API endpoints for demo management
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  Req,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { DemoService } from "./demo.service";
import { ParseOptionsDto } from "./dto/demo.dto";

@ApiTags("demos")
@Controller({ path: "demos", version: "1" })
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload a demo file for parsing" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "CS2 demo file (.dem)",
        },
        autoparse: {
          type: "boolean",
          description: "Automatically start parsing after upload",
          default: true,
        },
      },
      required: ["file"],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Demo uploaded and queued for parsing",
  })
  async uploadDemo(@Req() request: FastifyRequest) {
    const data = await request.file();

    if (!data) {
      throw new BadRequestException("No file provided");
    }

    if (!data.filename.endsWith(".dem")) {
      throw new BadRequestException("File must be a .dem file");
    }

    // Read file content
    const buffer = await data.toBuffer();

    // Get autoparse option from fields
    const fields = data.fields as Record<string, { value?: string }>;
    const autoparse = fields.autoparse?.value !== "false";

    return this.demoService.uploadDemo({
      filename: data.filename,
      buffer,
      autoparse,
    });
  }

  @Post(":id/parse")
  @ApiOperation({ summary: "Start parsing an uploaded demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async parseDemo(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() options: ParseOptionsDto
  ) {
    return this.demoService.queueForParsing(id, options);
  }

  @Post(":id/retry")
  @ApiOperation({ summary: "Retry parsing a failed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async retryDemo(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.retryParsing(id);
  }

  @Get(":id/status")
  @ApiOperation({ summary: "Get parsing status for a demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getParseStatus(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getParseStatus(id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get demo metadata and info" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemo(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemo(id);
  }

  @Get(":id/events")
  @ApiOperation({ summary: "Get events from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiQuery({ name: "type", required: false, description: "Filter by event type" })
  @ApiQuery({ name: "round", required: false, description: "Filter by round number" })
  async getDemoEvents(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("type") eventType?: string,
    @Query("round") round?: string
  ) {
    const filters: { eventType?: string; round?: number } = {};
    if (eventType) filters.eventType = eventType;
    if (round !== undefined && round !== null && round !== "") {
      filters.round = parseInt(round, 10);
    }
    return this.demoService.getDemoEvents(id, filters);
  }

  @Get(":id/rounds")
  @ApiOperation({ summary: "Get round data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoRounds(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoRounds(id);
  }

  @Get(":id/players")
  @ApiOperation({ summary: "Get player data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoPlayers(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoPlayers(id);
  }

  @Get(":id/ticks")
  @ApiOperation({ summary: "Get tick data from a parsed demo (paginated)" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiQuery({ name: "startTick", required: false })
  @ApiQuery({ name: "endTick", required: false })
  @ApiQuery({ name: "interval", required: false, description: "Sample interval" })
  async getDemoTicks(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("startTick") startTick?: number,
    @Query("endTick") endTick?: number,
    @Query("interval") interval?: number
  ) {
    const options: { startTick?: number; endTick?: number; interval?: number } = {};
    if (startTick !== undefined) options.startTick = startTick;
    if (endTick !== undefined) options.endTick = endTick;
    if (interval !== undefined) options.interval = interval;
    return this.demoService.getDemoTicks(id, options);
  }

  @Get(":id/grenades")
  @ApiOperation({ summary: "Get grenade data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoGrenades(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoGrenades(id);
  }

  @Get(":id/chat")
  @ApiOperation({ summary: "Get chat messages from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoChatMessages(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoChatMessages(id);
  }

  @Get()
  @ApiOperation({ summary: "List all demos" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "map", required: false })
  async listDemos(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("map") map?: string
  ) {
    const options: { page: number; limit: number; map?: string } = { page, limit };
    if (map !== undefined) options.map = map;
    return this.demoService.listDemos(options);
  }
}
