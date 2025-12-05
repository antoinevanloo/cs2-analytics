/**
 * Onboarding DTOs
 *
 * Data transfer objects for the onboarding flow
 *
 * @module onboarding/dto
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsArray,
} from "class-validator";
import { PreferredRole } from "@prisma/client";

// ============================================================================
// Enums
// ============================================================================

export enum OnboardingStep {
  WELCOME = 0,
  CONNECT_ACCOUNTS = 1,
  SELECT_ROLE = 2,
  IMPORT_MATCHES = 3,
  FIRST_INSIGHT = 4,
  GUIDED_TOUR = 5,
  COMPLETED = 6,
}

export enum ImportSource {
  FACEIT = "FACEIT",
  STEAM = "STEAM",
  MANUAL = "MANUAL",
}

export enum ImportStatus {
  IDLE = "IDLE",
  QUEUED = "QUEUED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

// ============================================================================
// Request DTOs (validated classes)
// ============================================================================

export class UpdateOnboardingStepDto {
  @ApiProperty({
    description: "The onboarding step to update to",
    enum: OnboardingStep,
    example: OnboardingStep.SELECT_ROLE,
  })
  @IsNumber()
  @Min(0)
  @Max(6)
  step!: number;

  @ApiPropertyOptional({
    description: "Additional data for the step",
    example: { preferredRole: "PLAYER" },
  })
  @IsOptional()
  data?: Record<string, unknown>;
}

export class SelectRoleDto {
  @ApiProperty({
    description: "The user's preferred role",
    enum: PreferredRole,
    example: "PLAYER",
  })
  @IsEnum(PreferredRole)
  role!: PreferredRole;

  @ApiPropertyOptional({
    description: "Specific focus areas for the role",
    example: ["rating", "adr"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];
}

export class StartImportDto {
  @ApiProperty({
    description: "Import source",
    enum: ImportSource,
    example: ImportSource.FACEIT,
  })
  @IsEnum(ImportSource)
  source!: ImportSource;

  @ApiPropertyOptional({
    description: "Number of matches to import (max 20)",
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  matchCount?: number;

  @ApiPropertyOptional({
    description: "Enable auto-import for future matches",
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enableAutoImport?: boolean;
}

export class SkipImportDto {
  @ApiPropertyOptional({
    description: "Reason for skipping import",
    example: "Will import later",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============================================================================
// Response Types (interfaces for type safety)
// ============================================================================

export interface OnboardingStatusResponse {
  currentStep: OnboardingStep;
  isCompleted: boolean;
  completedAt: string | null;
  completedSteps: number[];
  connectedAccounts: {
    steam: boolean;
    faceit: boolean;
  };
  selectedRole: PreferredRole | null;
  importStatus: {
    status: ImportStatus;
    source: ImportSource | null;
    progress: number;
    matchesImported: number;
    matchesTotal: number;
  } | null;
}

export interface FirstInsightResponse {
  rating: {
    value: number;
    label: string;
    percentile: number;
  };
  topStrength: {
    metric: string;
    label: string;
    value: number;
    insight: string;
  };
  mainWeakness: {
    metric: string;
    label: string;
    value: number;
    insight: string;
    improvementTip: string;
  };
  matchesAnalyzed: number;
  nextStep: {
    title: string;
    description: string;
    actionUrl: string;
  };
}

export interface ImportProgressResponse {
  jobId: string;
  status: ImportStatus;
  source: ImportSource;
  progress: number;
  matchesImported: number;
  matchesTotal: number;
  currentMatch: {
    id: string;
    map: string;
    date: string;
  } | null;
  error: string | null;
  estimatedTimeRemaining: number | null;
}

export interface CompleteOnboardingResponse {
  success: boolean;
  redirectUrl: string;
  summary: {
    accountsConnected: string[];
    matchesImported: number;
    selectedRole: PreferredRole;
    insightGenerated: boolean;
  };
}
