/**
 * User DTOs - Data Transfer Objects for user endpoints
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsObject,
  Min,
  Max,
} from "class-validator";
import { PreferredRole, ProfileVisibility } from "@prisma/client";

// Update preferences DTO
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: "Preferred dashboard role",
    enum: ["PLAYER", "COACH", "SCOUT", "ANALYST", "CREATOR"],
  })
  @IsEnum(PreferredRole)
  @IsOptional()
  preferredRole?: PreferredRole;

  @ApiPropertyOptional({
    description: "Dashboard layout configuration (widget positions)",
  })
  @IsObject()
  @IsOptional()
  dashboardLayout?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "List of favorite metrics to display",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favoriteMetrics?: string[];

  @ApiPropertyOptional({
    description: "Default time range for analytics",
    enum: ["7d", "30d", "90d", "all"],
  })
  @IsString()
  @IsOptional()
  defaultTimeRange?: string;

  @ApiPropertyOptional({
    description: "Enable email notifications",
  })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description: "Enable weekly digest emails",
  })
  @IsBoolean()
  @IsOptional()
  weeklyDigest?: boolean;

  @ApiPropertyOptional({
    description: "Enable automatic FACEIT match import",
  })
  @IsBoolean()
  @IsOptional()
  faceitAutoImport?: boolean;

  @ApiPropertyOptional({
    description: "Hours between auto-imports",
    minimum: 1,
    maximum: 168,
  })
  @IsNumber()
  @Min(1)
  @Max(168)
  @IsOptional()
  faceitImportInterval?: number;

  @ApiPropertyOptional({
    description: "UI theme preference",
    enum: ["light", "dark", "system"],
  })
  @IsString()
  @IsOptional()
  theme?: string;

  @ApiPropertyOptional({
    description: "Enable compact UI mode",
  })
  @IsBoolean()
  @IsOptional()
  compactMode?: boolean;

  @ApiPropertyOptional({
    description: "Show advanced statistics",
  })
  @IsBoolean()
  @IsOptional()
  showAdvancedStats?: boolean;

  @ApiPropertyOptional({
    description: "Profile visibility setting",
    enum: ["PUBLIC", "FRIENDS", "PRIVATE"],
  })
  @IsEnum(ProfileVisibility)
  @IsOptional()
  profileVisibility?: ProfileVisibility;

  @ApiPropertyOptional({
    description: "Allow sharing stats with team",
  })
  @IsBoolean()
  @IsOptional()
  shareStats?: boolean;
}

// User profile response
export class UserProfileResponse {
  @ApiProperty({ description: "User ID" })
  id!: string;

  @ApiProperty({ description: "User email" })
  email!: string;

  @ApiPropertyOptional({ description: "Display name" })
  name?: string | null;

  @ApiPropertyOptional({ description: "Avatar URL" })
  avatar?: string | null;

  @ApiPropertyOptional({ description: "Steam ID" })
  steamId?: string | null;

  @ApiPropertyOptional({ description: "FACEIT ID" })
  faceitId?: string | null;

  @ApiProperty({ description: "Subscription plan" })
  plan!: string;

  @ApiPropertyOptional({ description: "Plan expiration date" })
  planExpiresAt?: Date | null;

  @ApiProperty({ description: "Account creation date" })
  createdAt!: Date;
}

// User preferences response
export class UserPreferencesResponse {
  @ApiProperty({ description: "Preferred dashboard role" })
  preferredRole!: string;

  @ApiPropertyOptional({ description: "Dashboard layout" })
  dashboardLayout?: Record<string, unknown> | null;

  @ApiProperty({ description: "Favorite metrics", type: [String] })
  favoriteMetrics!: string[];

  @ApiProperty({ description: "Default time range" })
  defaultTimeRange!: string;

  @ApiProperty({ description: "Email notifications enabled" })
  emailNotifications!: boolean;

  @ApiProperty({ description: "Weekly digest enabled" })
  weeklyDigest!: boolean;

  @ApiProperty({ description: "Current onboarding step" })
  onboardingStep!: number;

  @ApiPropertyOptional({ description: "Onboarding completion date" })
  onboardingCompletedAt?: Date | null;

  @ApiProperty({ description: "Has seen welcome modal" })
  hasSeenWelcome!: boolean;

  @ApiProperty({ description: "Has completed product tour" })
  hasCompletedTour!: boolean;

  @ApiProperty({ description: "FACEIT auto-import enabled" })
  faceitAutoImport!: boolean;

  @ApiProperty({ description: "FACEIT import interval in hours" })
  faceitImportInterval!: number;

  @ApiProperty({ description: "Theme preference" })
  theme!: string;

  @ApiProperty({ description: "Compact mode enabled" })
  compactMode!: boolean;

  @ApiProperty({ description: "Show advanced stats" })
  showAdvancedStats!: boolean;

  @ApiProperty({ description: "Profile visibility" })
  profileVisibility!: string;

  @ApiProperty({ description: "Share stats with team" })
  shareStats!: boolean;
}

// Onboarding step update DTO
export class UpdateOnboardingDto {
  @ApiProperty({
    description: "Onboarding step number",
    minimum: 0,
    maximum: 10,
  })
  @IsNumber()
  @Min(0)
  @Max(10)
  step!: number;

  @ApiPropertyOptional({
    description: "Mark onboarding as completed",
  })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

// Dashboard data request DTO
export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: "Time range for data",
    enum: ["7d", "30d", "90d", "all"],
    default: "30d",
  })
  @IsString()
  @IsOptional()
  timeRange?: string;

  @ApiPropertyOptional({
    description: "Specific team ID to filter by",
  })
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({
    description: "Include detailed breakdowns",
  })
  @IsBoolean()
  @IsOptional()
  detailed?: boolean;
}
