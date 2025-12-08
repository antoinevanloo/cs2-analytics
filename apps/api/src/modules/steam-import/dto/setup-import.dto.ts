/**
 * Steam Import DTOs
 *
 * Data Transfer Objects for Steam import API endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  IsInt,
  Min,
  Max,
} from "class-validator";

/**
 * DTO for setting up Steam import
 */
export class SetupImportDto {
  @ApiProperty({
    description:
      "Game authentication code from Steam Help (format: XXXX-XXXXX-XXXX)",
    example: "ABCD-EFGHI-JKLM",
  })
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/, {
    message:
      "Auth code must be in format XXXX-XXXXX-XXXX (uppercase letters and numbers)",
  })
  authCode!: string;

  @ApiProperty({
    description:
      "Initial share code from match history (format: CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx)",
    example: "CSGO-ZT42K-Jxxxx-Kxxxx-5xxxx-Oixxx",
  })
  @IsString()
  @Matches(
    /^CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/,
    {
      message:
        "Share code must be in format CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx",
    },
  )
  initialShareCode!: string;

  @ApiPropertyOptional({
    description: "Import Premier matches",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  importPremier?: boolean = true;

  @ApiPropertyOptional({
    description: "Import Competitive matches",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  importCompetitive?: boolean = true;

  @ApiPropertyOptional({
    description: "Automatically download demos after sync",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoDownloadDemos?: boolean = true;
}

/**
 * DTO for updating import configuration
 */
export class UpdateImportConfigDto {
  @ApiPropertyOptional({
    description: "New auth code (if regenerated)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/, {
    message:
      "Auth code must be in format XXXX-XXXXX-XXXX (uppercase letters and numbers)",
  })
  authCode?: string;

  @ApiPropertyOptional({
    description: "Import Premier matches",
  })
  @IsOptional()
  @IsBoolean()
  importPremier?: boolean;

  @ApiPropertyOptional({
    description: "Import Competitive matches",
  })
  @IsOptional()
  @IsBoolean()
  importCompetitive?: boolean;

  @ApiPropertyOptional({
    description: "Automatically download demos after sync",
  })
  @IsOptional()
  @IsBoolean()
  autoDownloadDemos?: boolean;
}

/**
 * DTO for listing matches with filtering
 */
export class ListMatchesQueryDto {
  @ApiPropertyOptional({
    description: "Page number",
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Filter by download status",
    enum: [
      "PENDING",
      "URL_FETCHED",
      "DOWNLOADING",
      "DOWNLOADED",
      "PARSING",
      "COMPLETED",
      "FAILED",
      "EXPIRED",
      "UNAVAILABLE",
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: "Filter by game mode",
    enum: ["COMPETITIVE", "PREMIER"],
  })
  @IsOptional()
  @IsString()
  gameMode?: string;
}
