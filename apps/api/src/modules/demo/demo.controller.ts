/**
 * Demo Controller - REST API endpoints for demo management
 *
 * Features:
 * - Stream-based file upload (memory-efficient for large demos)
 * - Multipart form-data handling with backpressure
 * - Access control: users can only see their own demos or demos they participated in
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
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
import { DemoAccessService } from "./demo-access.service";
import { ParseOptionsDto } from "./dto/demo.dto";
import { Roles, CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

// Maximum demo file size (500MB - typical competitive demo ~150MB)
const MAX_DEMO_SIZE = 500 * 1024 * 1024;

@ApiTags("Demos")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "demos", version: "1" })
export class DemoController {
  constructor(
    private readonly demoService: DemoService,
    private readonly demoAccessService: DemoAccessService,
  ) {}

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
  async uploadDemo(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
  ) {
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
        userId: user.id,
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
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async parseDemo(
    @Param("id") id: string,
    @Body() options: ParseOptionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.queueForParsing(id, options);
  }

  @Post(":id/retry")
  @Roles("user")
  @ApiOperation({ summary: "Retry parsing a failed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async retryDemo(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.retryParsing(id);
  }

  @Post(":id/reparse")
  @Roles("user")
  @ApiOperation({
    summary: "Re-parse a demo with tick extraction enabled",
    description:
      "Re-parses a demo that was parsed without tick data, enabling 2D replay support. " +
      "Uses the 'replay' parsing profile by default (extractTicks=true, tickInterval=4). " +
      "Existing tick data will be deleted and replaced with new data.",
  })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiBody({
    type: ParseOptionsDto,
    required: false,
    description: "Optional parsing options to override defaults",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Demo queued for re-parsing",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        jobId: { type: "string" },
        options: {
          type: "object",
          properties: {
            extractTicks: { type: "boolean" },
            tickInterval: { type: "number" },
            extractGrenades: { type: "boolean" },
            extractChat: { type: "boolean" },
          },
        },
        message: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Demo file no longer exists or demo is already being parsed",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to re-parse this demo",
  })
  async reparseDemo(
    @Param("id") id: string,
    @Body() options: ParseOptionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.reparseDemo(id, user.id, options);
  }

  @Get(":id/needs-reparse")
  @Roles("user")
  @ApiOperation({
    summary: "Check if a demo needs re-parsing for 2D replay",
    description:
      "Returns whether the demo has tick data for 2D replay support. " +
      "If needsReparse is true, call POST /demos/:id/reparse to enable replay.",
  })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Re-parse status",
    schema: {
      type: "object",
      properties: {
        needsReparse: { type: "boolean" },
        reason: { type: "string" },
        currentOptions: {
          type: "object",
          nullable: true,
          properties: {
            extractTicks: { type: "boolean" },
            tickInterval: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async checkNeedsReparse(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.needsReparse(id);
  }

  @Post(":id/recompute-stats")
  @Roles("user")
  @ApiOperation({
    summary: "Recompute round player stats for a demo",
    description:
      "Recalculates RoundPlayerStats from game events. " +
      "Use this to fix demos that were parsed before stats computation was implemented. " +
      "Also clears cached analysis results to force fresh calculation.",
  })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Stats recomputed successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        recordsCreated: { type: "number" },
        durationMs: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Demo is not in COMPLETED status",
  })
  async recomputeStats(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.recomputeRoundPlayerStats(id);
  }

  @Get(":id/status")
  @Roles("user")
  @ApiOperation({ summary: "Get parsing status for a demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getParseStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.getParseStatus(id);
  }

  @Get(":id")
  @Roles("user")
  @ApiOperation({ summary: "Get demo metadata and info" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemo(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.getDemo(id);
  }

  @Get(":id/events")
  @Roles("user")
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
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemoEvents(
    @Param("id") id: string,
    @Query("type") eventType?: string,
    @Query("round") round?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user || null);
    const filters: { eventType?: string; round?: number } = {};
    if (eventType) filters.eventType = eventType;
    if (round !== undefined && round !== null && round !== "") {
      filters.round = parseInt(round, 10);
    }
    return this.demoService.getDemoEvents(id, filters);
  }

  @Get(":id/rounds")
  @Roles("user")
  @ApiOperation({ summary: "Get round data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemoRounds(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.getDemoRounds(id);
  }

  @Get(":id/players")
  @Roles("user")
  @ApiOperation({ summary: "Get player data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemoPlayers(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.getDemoPlayers(id);
  }

  @Get(":id/ticks")
  @Roles("user")
  @ApiOperation({ summary: "Get tick data from a parsed demo (paginated)" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiQuery({ name: "startTick", required: false })
  @ApiQuery({ name: "endTick", required: false })
  @ApiQuery({
    name: "interval",
    required: false,
    description: "Sample interval",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemoTicks(
    @Param("id") id: string,
    @Query("startTick") startTick?: number,
    @Query("endTick") endTick?: number,
    @Query("interval") interval?: number,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user || null);
    const options: { startTick?: number; endTick?: number; interval?: number } =
      {};
    if (startTick !== undefined) options.startTick = startTick;
    if (endTick !== undefined) options.endTick = endTick;
    if (interval !== undefined) options.interval = interval;
    return this.demoService.getDemoTicks(id, options);
  }

  @Get(":id/grenades")
  @Roles("user")
  @ApiOperation({ summary: "Get grenade data from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemoGrenades(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.getDemoGrenades(id);
  }

  @Get(":id/chat")
  @Roles("user")
  @ApiOperation({ summary: "Get chat messages from a parsed demo" })
  @ApiParam({ name: "id", description: "Demo UUID" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not authorized to access this demo",
  })
  async getDemoChatMessages(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.demoAccessService.assertCanAccessDemo(id, user);
    return this.demoService.getDemoChatMessages(id);
  }

  @Get()
  @Roles("user")
  @ApiOperation({ summary: "List demos accessible to the current user" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "map", required: false })
  async listDemos(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("map") map?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    // Build access filter based on user permissions
    const accessFilter = this.demoAccessService.buildAccessFilter(user || null);

    const options: {
      page: number;
      limit: number;
      map?: string;
      accessFilter?: typeof accessFilter;
    } = {
      page,
      limit,
      accessFilter,
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
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.demoService.deleteDemo(id, user.id);
  }
}
