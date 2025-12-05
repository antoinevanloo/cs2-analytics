/**
 * Demo Controller - REST API endpoints for demo management
 *
 * Features:
 * - Stream-based file upload (memory-efficient for large demos)
 * - Multipart form-data handling with backpressure
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  Req,
  BadRequestException,
  PayloadTooLargeException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { DemoService } from "./demo.service";
import { ParseOptionsDto } from "./dto/demo.dto";
import { Public, Roles, CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

// Maximum demo file size (500MB - typical competitive demo ~150MB)
const MAX_DEMO_SIZE = 500 * 1024 * 1024;

@ApiTags("Demos")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "demos", version: "1" })
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post("upload")
  @Roles("user")
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
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: "Demo file exceeds maximum size limit",
  })
  async uploadDemo(@Req() request: FastifyRequest) {
    const data = await request.file({
      limits: {
        fileSize: MAX_DEMO_SIZE,
      },
    });

    if (!data) {
      throw new BadRequestException("No file provided");
    }

    if (!data.filename.endsWith(".dem")) {
      throw new BadRequestException("File must be a .dem file");
    }

    // Get autoparse option from fields before consuming file stream
    const fields = data.fields as Record<string, { value?: string }>;
    const autoparse = fields.autoparse?.value !== "false";

    try {
      // Stream-based upload: never loads entire file into memory
      // Uses pipeline to write to disk while calculating hash
      return await this.demoService.uploadDemoStream({
        filename: data.filename,
        fileStream: data.file,
        autoparse,
      });
    } catch (error) {
      // Handle file size limit exceeded
      if (error instanceof Error && error.message.includes("limit")) {
        throw new PayloadTooLargeException(
          `Demo file exceeds maximum size of ${MAX_DEMO_SIZE / 1024 / 1024}MB`,
        );
      }
      throw error;
    }
  }

  @Post(":id/parse")
  @Roles("user")
  @ApiOperation({ summary: "Start parsing an uploaded demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async parseDemo(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() options: ParseOptionsDto,
  ) {
    return this.demoService.queueForParsing(id, options);
  }

  @Post(":id/retry")
  @Roles("user")
  @ApiOperation({ summary: "Retry parsing a failed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async retryDemo(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.retryParsing(id);
  }

  @Get(":id/status")
  @Public()
  @ApiOperation({ summary: "Get parsing status for a demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getParseStatus(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getParseStatus(id);
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Get demo metadata and info" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemo(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemo(id);
  }

  @Get(":id/events")
  @Public()
  @ApiOperation({ summary: "Get events from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiQuery({
    name: "type",
    required: false,
    description: "Filter by event type",
  })
  @ApiQuery({
    name: "round",
    required: false,
    description: "Filter by round number",
  })
  async getDemoEvents(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("type") eventType?: string,
    @Query("round") round?: string,
  ) {
    const filters: { eventType?: string; round?: number } = {};
    if (eventType) filters.eventType = eventType;
    if (round !== undefined && round !== null && round !== "") {
      filters.round = parseInt(round, 10);
    }
    return this.demoService.getDemoEvents(id, filters);
  }

  @Get(":id/rounds")
  @Public()
  @ApiOperation({ summary: "Get round data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoRounds(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoRounds(id);
  }

  @Get(":id/players")
  @Public()
  @ApiOperation({ summary: "Get player data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoPlayers(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoPlayers(id);
  }

  @Get(":id/ticks")
  @Public()
  @ApiOperation({ summary: "Get tick data from a parsed demo (paginated)" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiQuery({ name: "startTick", required: false })
  @ApiQuery({ name: "endTick", required: false })
  @ApiQuery({
    name: "interval",
    required: false,
    description: "Sample interval",
  })
  async getDemoTicks(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("startTick") startTick?: number,
    @Query("endTick") endTick?: number,
    @Query("interval") interval?: number,
  ) {
    const options: { startTick?: number; endTick?: number; interval?: number } =
      {};
    if (startTick !== undefined) options.startTick = startTick;
    if (endTick !== undefined) options.endTick = endTick;
    if (interval !== undefined) options.interval = interval;
    return this.demoService.getDemoTicks(id, options);
  }

  @Get(":id/grenades")
  @Public()
  @ApiOperation({ summary: "Get grenade data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoGrenades(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoGrenades(id);
  }

  @Get(":id/chat")
  @Public()
  @ApiOperation({ summary: "Get chat messages from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  async getDemoChatMessages(@Param("id", ParseUUIDPipe) id: string) {
    return this.demoService.getDemoChatMessages(id);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "List all demos" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "map", required: false })
  async listDemos(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("map") map?: string,
  ) {
    const options: { page: number; limit: number; map?: string } = {
      page,
      limit,
    };
    if (map !== undefined) options.map = map;
    return this.demoService.listDemos(options);
  }

  @Delete(":id")
  @Roles("user")
  @ApiOperation({ summary: "Delete a demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Demo deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Demo not found",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to delete this demo",
  })
  async deleteDemo(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.demoService.deleteDemo(id, user.id);
  }
}
