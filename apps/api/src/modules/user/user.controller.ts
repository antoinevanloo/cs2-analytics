/**
 * User Controller - REST API endpoints for user management
 *
 * Endpoints:
 * - GET  /v1/user/me              - Get current user profile
 * - GET  /v1/user/me/preferences  - Get user preferences
 * - PATCH /v1/user/me/preferences - Update user preferences
 * - GET  /v1/user/me/dashboard/:role - Get role-specific dashboard
 * - POST /v1/user/me/onboarding   - Update onboarding progress
 * - POST /v1/user/me/welcome-seen - Mark welcome as seen
 * - POST /v1/user/me/tour-completed - Mark tour as completed
 */

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { PreferredRole } from "@prisma/client";
import { UserService } from "./user.service";
import {
  UpdatePreferencesDto,
  UserProfileResponse,
  UserPreferencesResponse,
  UpdateOnboardingDto,
  DashboardQueryDto,
} from "./dto/user.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

// Type for authenticated request
interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags("User")
@Controller("v1/user")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get current user profile
   */
  @Get("me")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile",
    type: UserProfileResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Request() req: AuthenticatedRequest) {
    return this.userService.getProfile(req.user.id);
  }

  /**
   * Get user preferences
   */
  @Get("me/preferences")
  @ApiOperation({ summary: "Get user preferences" })
  @ApiResponse({
    status: 200,
    description: "User preferences",
    type: UserPreferencesResponse,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPreferences(@Request() req: AuthenticatedRequest) {
    return this.userService.getPreferences(req.user.id);
  }

  /**
   * Update user preferences
   */
  @Patch("me/preferences")
  @ApiOperation({ summary: "Update user preferences" })
  @ApiResponse({
    status: 200,
    description: "Updated preferences",
    type: UserPreferencesResponse,
  })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updatePreferences(
    @Request() req: AuthenticatedRequest,
    @Body() data: UpdatePreferencesDto,
  ) {
    return this.userService.updatePreferences(req.user.id, data);
  }

  /**
   * Get role-specific dashboard data
   */
  @Get("me/dashboard/:role")
  @ApiOperation({ summary: "Get dashboard data for a specific role" })
  @ApiParam({
    name: "role",
    description: "Dashboard role",
    enum: ["PLAYER", "COACH", "SCOUT", "ANALYST", "CREATOR"],
  })
  @ApiResponse({ status: 200, description: "Dashboard data" })
  @ApiResponse({ status: 400, description: "Invalid role" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getDashboard(
    @Request() req: AuthenticatedRequest,
    @Param("role") role: string,
    @Query() query: DashboardQueryDto,
  ) {
    // Validate role
    const validRoles = Object.values(PreferredRole);
    if (!validRoles.includes(role as PreferredRole)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      );
    }

    return this.userService.getDashboardData(
      req.user.id,
      role as PreferredRole,
      query,
    );
  }

  /**
   * Get dashboard for user's preferred role
   */
  @Get("me/dashboard")
  @ApiOperation({ summary: "Get dashboard for preferred role" })
  @ApiResponse({ status: 200, description: "Dashboard data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPreferredDashboard(
    @Request() req: AuthenticatedRequest,
    @Query() query: DashboardQueryDto,
  ) {
    const preferences = await this.userService.getPreferences(req.user.id);
    return this.userService.getDashboardData(
      req.user.id,
      preferences.preferredRole as PreferredRole,
      query,
    );
  }

  /**
   * Update onboarding progress
   */
  @Post("me/onboarding")
  @ApiOperation({ summary: "Update onboarding progress" })
  @ApiResponse({ status: 200, description: "Onboarding updated" })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateOnboarding(
    @Request() req: AuthenticatedRequest,
    @Body() data: UpdateOnboardingDto,
  ) {
    return this.userService.updateOnboarding(
      req.user.id,
      data.step,
      data.completed,
    );
  }

  /**
   * Mark welcome modal as seen
   */
  @Post("me/welcome-seen")
  @ApiOperation({ summary: "Mark welcome modal as seen" })
  @ApiResponse({ status: 200, description: "Welcome marked as seen" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async markWelcomeSeen(@Request() req: AuthenticatedRequest) {
    await this.userService.markWelcomeSeen(req.user.id);
    return { success: true };
  }

  /**
   * Mark product tour as completed
   */
  @Post("me/tour-completed")
  @ApiOperation({ summary: "Mark product tour as completed" })
  @ApiResponse({ status: 200, description: "Tour marked as completed" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async markTourCompleted(@Request() req: AuthenticatedRequest) {
    await this.userService.markTourCompleted(req.user.id);
    return { success: true };
  }
}
