/**
 * Share Code Service
 *
 * Handles encoding and decoding of CS2 match share codes.
 * Share codes are in format: CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx
 *
 * Uses csgo-sharecode package with field mapping:
 * - matchId -> matchId
 * - reservationId -> outcomeId
 * - tvPort -> token
 *
 * @module steam-import/services
 */

import { Injectable, Logger } from "@nestjs/common";
import {
  decodeMatchShareCode,
  encodeMatch,
} from "csgo-sharecode";
import type { ShareCodeData } from "../types/steam-import.types";

// Share code regex pattern
const SHARE_CODE_PATTERN =
  /^CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/;

@Injectable()
export class ShareCodeService {
  private readonly logger = new Logger(ShareCodeService.name);

  /**
   * Validate share code format
   *
   * @param shareCode - Share code to validate
   * @returns true if valid format
   */
  isValid(shareCode: string): boolean {
    if (!shareCode || typeof shareCode !== "string") {
      return false;
    }
    return SHARE_CODE_PATTERN.test(shareCode);
  }

  /**
   * Decode a share code into its components
   *
   * @param shareCode - Share code in CSGO-xxxxx-xxxxx format
   * @returns Decoded data with matchId, outcomeId, token
   * @throws Error if share code is invalid
   */
  decode(shareCode: string): ShareCodeData {
    if (!this.isValid(shareCode)) {
      throw new Error(`Invalid share code format: ${shareCode}`);
    }

    try {
      // csgo-sharecode uses different field names
      // matchId -> matchId
      // reservationId -> outcomeId
      // tvPort -> token
      const decoded = decodeMatchShareCode(shareCode);

      return {
        matchId: decoded.matchId,
        outcomeId: decoded.reservationId,
        token: decoded.tvPort,
      };
    } catch (error) {
      this.logger.error(`Failed to decode share code: ${shareCode}`, error);
      throw new Error(
        `Failed to decode share code: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Encode components back into a share code
   *
   * @param data - Share code data with matchId, outcomeId, token
   * @returns Encoded share code string
   */
  encode(data: ShareCodeData): string {
    try {
      return encodeMatch({
        matchId: data.matchId,
        reservationId: data.outcomeId,
        tvPort: data.token,
      });
    } catch (error) {
      this.logger.error("Failed to encode share code", error);
      throw new Error(
        `Failed to encode share code: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Safe decode that returns null on error instead of throwing
   *
   * @param shareCode - Share code to decode
   * @returns Decoded data or null if invalid
   */
  tryDecode(shareCode: string): ShareCodeData | null {
    try {
      return this.decode(shareCode);
    } catch {
      return null;
    }
  }

  /**
   * Extract just the match ID from a share code
   * Useful for quick lookups
   *
   * @param shareCode - Share code to extract from
   * @returns Match ID as bigint or null if invalid
   */
  extractMatchId(shareCode: string): bigint | null {
    const data = this.tryDecode(shareCode);
    return data?.matchId ?? null;
  }
}
