/**
 * Parsing Configuration - Centralized configuration for demo parsing
 *
 * Architecture Principles:
 * - Extensibility: Easy to add new parsing profiles without code changes
 * - Scalability: Profiles optimized for different use cases (lite/standard/full)
 * - Performance: Default values balance quality vs parsing time
 * - Auditability: All options are typed and documented
 *
 * Configuration Hierarchy (lower overrides higher):
 * 1. Environment variables (PARSING_*)
 * 2. Profile defaults (lite, standard, full)
 * 3. Request-level overrides (ParseOptionsDto)
 */

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Parsing options structure - matches ParseOptionsDto
 * Used for both configuration and storage (Demo.parseOptions)
 */
export interface ParseOptions {
  extractTicks: boolean;
  tickInterval: number;
  extractGrenades: boolean;
  extractChat: boolean;
  events?: string[] | undefined;
  properties?: string[] | undefined;
}

/**
 * Predefined parsing profiles for different use cases
 *
 * Extensibility: Add new profiles here without modifying other code
 * Concurrence: Profiles designed to match/beat competitor features
 */
export type ParsingProfile = "lite" | "standard" | "full" | "replay";

/**
 * Profile configurations with performance characteristics
 *
 * Performance targets:
 * - lite: <10s parse time, minimal storage
 * - standard: <15s parse time, good quality replay
 * - full: <30s parse time, maximum detail
 * - replay: <20s parse time, optimized for 2D replay
 */
const PARSING_PROFILES: Record<ParsingProfile, ParseOptions> = {
  // Lite: Fast parsing without tick data (stats only)
  // Use case: Quick stats preview, batch processing
  lite: {
    extractTicks: false,
    tickInterval: 128, // Ignored when extractTicks=false
    extractGrenades: false,
    extractChat: true,
  },

  // Standard: Balanced for most use cases
  // Use case: Default upload, good replay quality
  // tick_interval=8 = ~8 frames/second at 64 tick (smooth enough for replay)
  standard: {
    extractTicks: true,
    tickInterval: 8,
    extractGrenades: true,
    extractChat: true,
  },

  // Full: Maximum detail for pro analysis
  // Use case: Coach review, detailed analysis
  // tick_interval=1 = every tick (64 fps equivalent)
  full: {
    extractTicks: true,
    tickInterval: 1,
    extractGrenades: true,
    extractChat: true,
  },

  // Replay: Optimized specifically for 2D replay viewer
  // Use case: Re-parsing demos that were parsed without ticks
  // tick_interval=4 = ~16 frames/second (smooth 60fps playback with interpolation)
  replay: {
    extractTicks: true,
    tickInterval: 4,
    extractGrenades: true, // Grenades visible in replay
    extractChat: false, // Not needed for visual replay
  },
};

/**
 * Current parser version - increment when parser output format changes
 * Used for migration and compatibility checks
 */
export const PARSER_VERSION = 1;

@Injectable()
export class ParsingConfigService {
  private readonly defaultProfile: ParsingProfile;

  constructor(private configService: ConfigService) {
    // Allow environment override of default profile
    const envProfile = this.configService.get<string>("PARSING_DEFAULT_PROFILE");
    this.defaultProfile = this.isValidProfile(envProfile) ? envProfile : "standard";
  }

  /**
   * Get the default parsing options
   * Uses environment-configured profile or 'standard'
   */
  getDefaultOptions(): ParseOptions {
    return this.getProfileOptions(this.defaultProfile);
  }

  /**
   * Get options for a specific profile
   */
  getProfileOptions(profile: ParsingProfile): ParseOptions {
    return { ...PARSING_PROFILES[profile] };
  }

  /**
   * Merge user options with defaults
   * User options override profile defaults
   *
   * @param userOptions - Partial options from request
   * @param profile - Base profile to use (defaults to environment config)
   */
  mergeOptions(
    userOptions?: Partial<ParseOptions>,
    profile?: ParsingProfile,
  ): ParseOptions {
    const baseProfile = profile ?? this.defaultProfile;
    const baseOptions = this.getProfileOptions(baseProfile);

    if (!userOptions) {
      return baseOptions;
    }

    return {
      extractTicks: userOptions.extractTicks ?? baseOptions.extractTicks,
      tickInterval: userOptions.tickInterval ?? baseOptions.tickInterval,
      extractGrenades: userOptions.extractGrenades ?? baseOptions.extractGrenades,
      extractChat: userOptions.extractChat ?? baseOptions.extractChat,
      events: userOptions.events ?? baseOptions.events,
      properties: userOptions.properties ?? baseOptions.properties,
    };
  }

  /**
   * Get optimal options for re-parsing (enable tick extraction)
   * Used when a demo needs tick data but was parsed without it
   */
  getReparseOptions(): ParseOptions {
    return this.getProfileOptions("replay");
  }

  /**
   * Check if a demo needs re-parsing for 2D replay
   *
   * @param currentOptions - Options used for original parse
   */
  needsReparseForReplay(currentOptions?: ParseOptions | null): boolean {
    if (!currentOptions) return true;
    return !currentOptions.extractTicks;
  }

  /**
   * Get current parser version for storage
   */
  getParserVersion(): number {
    return PARSER_VERSION;
  }

  /**
   * Validate profile name
   */
  private isValidProfile(profile?: string): profile is ParsingProfile {
    return (
      profile === "lite" ||
      profile === "standard" ||
      profile === "full" ||
      profile === "replay"
    );
  }

  /**
   * Get all available profiles (for API documentation/UI)
   */
  getAvailableProfiles(): { name: ParsingProfile; description: string }[] {
    return [
      { name: "lite", description: "Fast parsing, stats only, no replay" },
      { name: "standard", description: "Balanced quality and performance" },
      { name: "full", description: "Maximum detail for pro analysis" },
      { name: "replay", description: "Optimized for 2D replay viewer" },
    ];
  }
}
