/**
 * Onboarding Controller - REST API endpoints for onboarding flow
 *
 * Endpoints:
 * - GET  /v1/onboarding/status           - Get current onboarding status
 * - POST /v1/onboarding/step             - Update onboarding step
 * - POST /v1/onboarding/role             - Select preferred role
 * - POST /v1/onboarding/import/start     - Start match import
 * - GET  /v1/onboarding/import/progress  - Get import progress
 * - POST /v1/onboarding/import/skip      - Skip import step
 * - POST /v1/onboarding/import/cancel    - Cancel ongoing import
 * - GET  /v1/onboarding/first-insight    - Get first insight (rating + weakness)
 * - POST /v1/onboarding/complete         - Complete onboarding
 *
 * @module onboarding
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { OnboardingService } from "./onboarding.service";
import {
  UpdateOnboardingStepDto,
  SelectRoleDto,
  StartImportDto,
  SkipImportDto,
  type OnboardingStatusResponse,
  type FirstInsightResponse,
  type ImportProgressResponse,
  type CompleteOnboardingResponse,
} from "./dto/onboarding.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

// Type for authenticated request
interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags("Onboarding")
@Controller("v1/onboarding")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ==========================================================================
  // Status
  // ==========================================================================

  /**
   * Get current onboarding status
   */
  @Get("status")
  @ApiOperation({ summary: "Get current onboarding status" })
  @ApiResponse({ status: 200, description: "Onboarding status" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getStatus(
    @Request() req: AuthenticatedRequest,
  ): Promise<OnboardingStatusResponse> {
    return this.onboardingService.getStatus(req.user.id);
  }

  /**
   * Update onboarding step
   */
  @Post("step")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update onboarding step" })
  @ApiResponse({ status: 200, description: "Updated onboarding status" })
  @ApiResponse({ status: 400, description: "Invalid step" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateStep(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateOnboardingStepDto,
  ): Promise<OnboardingStatusResponse> {
    return this.onboardingService.updateStep(req.user.id, dto.step, dto.data);
  }

  // ==========================================================================
  // Role Selection
  // ==========================================================================

  /**
   * Select preferred role
   */
  @Post("role")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Select preferred role during onboarding" })
  @ApiResponse({ status: 200, description: "Role selected, onboarding status updated" })
  @ApiResponse({ status: 400, description: "Invalid role" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async selectRole(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SelectRoleDto,
  ): Promise<OnboardingStatusResponse> {
    return this.onboardingService.selectRole(
      req.user.id,
      dto.role,
      dto.focusAreas,
    );
  }

  // ==========================================================================
  // Import
  // ==========================================================================

  /**
   * Start match import from connected account
   */
  @Post("import/start")
  @ApiOperation({ summary: "Start importing matches from connected account" })
  @ApiResponse({ status: 201, description: "Import job started" })
  @ApiResponse({ status: 400, description: "Account not connected or import already in progress" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async startImport(
    @Request() req: AuthenticatedRequest,
    @Body() dto: StartImportDto,
  ): Promise<ImportProgressResponse> {
    return this.onboardingService.startImport(
      req.user.id,
      dto.source,
      dto.matchCount,
      dto.enableAutoImport,
    );
  }

  /**
   * Get import progress
   */
  @Get("import/progress")
  @ApiOperation({ summary: "Get current import progress" })
  @ApiResponse({ status: 200, description: "Import progress" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getImportProgress(
    @Request() req: AuthenticatedRequest,
  ): Promise<ImportProgressResponse | null> {
    return this.onboardingService.getImportProgress(req.user.id);
  }

  /**
   * Skip import step
   */
  @Post("import/skip")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Skip the import step" })
  @ApiResponse({ status: 200, description: "Import skipped, onboarding status updated" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async skipImport(
    @Request() req: AuthenticatedRequest,
    @Body() _dto: SkipImportDto,
  ): Promise<OnboardingStatusResponse> {
    return this.onboardingService.skipImport(req.user.id);
  }

  /**
   * Cancel ongoing import
   */
  @Post("import/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel ongoing import" })
  @ApiResponse({ status: 200, description: "Import cancelled" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async cancelImport(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.cancelImport(req.user.id);
    return { success: true };
  }

  // ==========================================================================
  // First Insight
  // ==========================================================================

  /**
   * Get first insight (rating + weakness analysis)
   */
  @Get("first-insight")
  @ApiOperation({
    summary: "Get first insight - personalized rating and improvement area",
  })
  @ApiResponse({ status: 200, description: "First insight generated" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getFirstInsight(
    @Request() req: AuthenticatedRequest,
  ): Promise<FirstInsightResponse> {
    return this.onboardingService.getFirstInsight(req.user.id);
  }

  // ==========================================================================
  // Completion
  // ==========================================================================

  /**
   * Complete onboarding flow
   */
  @Post("complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete the onboarding flow" })
  @ApiResponse({ status: 200, description: "Onboarding completed" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async completeOnboarding(
    @Request() req: AuthenticatedRequest,
  ): Promise<CompleteOnboardingResponse> {
    return this.onboardingService.completeOnboarding(req.user.id);
  }

  /**
   * Quick bypass - mark welcome as seen
   */
  @Post("welcome-seen")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark welcome modal as seen (quick bypass)" })
  @ApiResponse({ status: 200, description: "Welcome marked as seen" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async markWelcomeSeen(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.markWelcomeSeen(req.user.id);
    return { success: true };
  }

  /**
   * Mark guided tour as completed
   */
  @Post("tour-completed")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark guided tour as completed" })
  @ApiResponse({ status: 200, description: "Tour marked as completed" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async markTourCompleted(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    await this.onboardingService.markTourCompleted(req.user.id);
    return { success: true };
  }
}
