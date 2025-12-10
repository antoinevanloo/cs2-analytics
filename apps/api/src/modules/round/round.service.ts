/**
 * Round Service - Business logic for round data
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class RoundService {
  async getRound(demoId: string, roundNumber: number) {
    // TODO: Fetch from parsed data
    return {
      demoId,
      roundNumber,
      startTick: 0,
      endTick: 0,
      winner: null,
      winReason: null,
      ctScore: 0,
      tScore: 0,
      bombPlanted: false,
      bombSite: null,
      playerStats: [],
    };
  }

  async getRoundTimeline(demoId: string, roundNumber: number) {
    return {
      demoId,
      roundNumber,
      events: [],
    };
  }

  async getRoundEconomy(demoId: string, roundNumber: number) {
    return {
      demoId,
      roundNumber,
      ct: {
        totalMoney: 0,
        equipmentValue: 0,
        spent: 0,
        players: [],
      },
      t: {
        totalMoney: 0,
        equipmentValue: 0,
        spent: 0,
        players: [],
      },
      roundType: "unknown",
    };
  }

  async getRoundKillfeed(demoId: string, roundNumber: number) {
    return {
      demoId,
      roundNumber,
      kills: [],
    };
  }
}
