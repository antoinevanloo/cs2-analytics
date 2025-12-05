import { PrismaClient, DemoStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface DemoEvent {
  event_name?: string;
  tick?: number;
  [key: string]: unknown;
}

async function recomputeRoundPlayerStats(demoId: string) {
  console.log(`\nRecomputing RoundPlayerStats for demo ${demoId}...\n`);
  const startTime = Date.now();

  // Verify demo exists and is completed
  const demo = await prisma.demo.findUnique({
    where: { id: demoId },
    select: { id: true, status: true },
  });

  if (!demo) {
    throw new Error(`Demo ${demoId} not found`);
  }

  if (demo.status !== DemoStatus.COMPLETED) {
    throw new Error(`Demo ${demoId} is not completed (status: ${demo.status})`);
  }

  // Get rounds
  const rounds = await prisma.round.findMany({
    where: { demoId },
    select: { id: true, roundNumber: true, startTick: true, endTick: true },
    orderBy: { roundNumber: "asc" },
  });
  console.log(`Found ${rounds.length} rounds`);

  // Get events from GameEvent table
  const gameEvents = await prisma.gameEvent.findMany({
    where: {
      demoId,
      eventName: { in: ["player_death", "player_hurt", "round_freeze_end"] },
    },
    select: { eventName: true, tick: true, data: true },
  });
  console.log(`Found ${gameEvents.length} relevant events`);

  // Transform to DemoEvent format
  const events: DemoEvent[] = gameEvents.map((e) => ({
    event_name: e.eventName,
    tick: e.tick,
    ...(e.data as Record<string, unknown>),
  }));

  // Delete existing RoundPlayerStats for this demo
  const deleteResult = await prisma.roundPlayerStats.deleteMany({
    where: { round: { demoId } },
  });
  console.log(`Deleted ${deleteResult.count} existing RoundPlayerStats`);

  // Get players
  const players = await prisma.matchPlayerStats.findMany({
    where: { demoId },
    select: { steamId: true, teamNum: true, playerName: true },
  });
  console.log(`Found ${players.length} players`);

  // Build player lookup
  const playerLookup = new Map(
    players.map((p) => [p.steamId, { teamNum: p.teamNum, name: p.playerName }])
  );

  // Build round lookup
  const findRoundForTick = (tick: number) => {
    return rounds.find((r) => tick >= r.startTick && tick <= r.endTick);
  };

  // Initialize stats
  type PlayerRoundStats = {
    steamId: string;
    teamNum: number;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    equipValue: number;
    moneySpent: number;
    startBalance: number;
    survived: boolean;
    firstKill: boolean;
    firstDeath: boolean;
    clutchVs: number | null;
    clutchWon: boolean | null;
  };

  const statsMap = new Map<string, Map<string, PlayerRoundStats>>();

  for (const round of rounds) {
    const roundStats = new Map<string, PlayerRoundStats>();
    for (const [steamId, playerInfo] of playerLookup) {
      roundStats.set(steamId, {
        steamId,
        teamNum: playerInfo.teamNum,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        equipValue: 0,
        moneySpent: 0,
        startBalance: 0,
        survived: true,
        firstKill: false,
        firstDeath: false,
        clutchVs: null,
        clutchWon: null,
      });
    }
    statsMap.set(round.id, roundStats);
  }

  // Track first kill/death per round
  const firstKillByRound = new Map<string, boolean>();
  const firstDeathByRound = new Map<string, boolean>();

  // Process events
  const sortedEvents = [...events].sort((a, b) => (a.tick || 0) - (b.tick || 0));

  for (const event of sortedEvents) {
    const round = findRoundForTick(event.tick || 0);
    if (!round) continue;

    const roundStats = statsMap.get(round.id);
    if (!roundStats) continue;

    switch (event.event_name) {
      case "player_death": {
        const attackerSteamId = event.attacker_steamid as string | undefined;
        const victimSteamId = event.user_steamid as string | undefined;
        const assisterSteamId = event.assister_steamid as string | undefined;
        const attackerTeam = event.attacker_team as number | undefined;
        const victimTeam = event.user_team as number | undefined;

        if (attackerSteamId && victimSteamId) {
          const isSuicide = attackerSteamId === victimSteamId;
          const isTeamkill =
            !isSuicide &&
            attackerTeam !== undefined &&
            victimTeam !== undefined &&
            attackerTeam === victimTeam;

          if (!isSuicide && !isTeamkill) {
            const attackerStats = roundStats.get(attackerSteamId);
            if (attackerStats) {
              attackerStats.kills++;
              if (!firstKillByRound.has(round.id)) {
                firstKillByRound.set(round.id, true);
                attackerStats.firstKill = true;
              }
            }
          }
        }

        if (victimSteamId) {
          const victimStats = roundStats.get(victimSteamId);
          if (victimStats) {
            victimStats.deaths++;
            victimStats.survived = false;
            if (!firstDeathByRound.has(round.id)) {
              firstDeathByRound.set(round.id, true);
              victimStats.firstDeath = true;
            }
          }
        }

        if (assisterSteamId) {
          const assisterStats = roundStats.get(assisterSteamId);
          if (assisterStats) {
            assisterStats.assists++;
          }
        }
        break;
      }

      case "player_hurt": {
        const attackerSteamId = event.attacker_steamid as string | undefined;
        const damage = (event.dmg_health as number) || 0;

        if (attackerSteamId && damage > 0) {
          const attackerStats = roundStats.get(attackerSteamId);
          if (attackerStats) {
            attackerStats.damage += damage;
          }
        }
        break;
      }
    }
  }

  // Convert to array
  const roundPlayerStatsData: any[] = [];
  for (const [roundId, playerStats] of statsMap) {
    for (const [, stats] of playerStats) {
      roundPlayerStatsData.push({
        roundId,
        steamId: stats.steamId,
        teamNum: stats.teamNum,
        kills: stats.kills,
        deaths: stats.deaths,
        assists: stats.assists,
        damage: stats.damage,
        equipValue: stats.equipValue,
        moneySpent: stats.moneySpent,
        startBalance: stats.startBalance,
        survived: stats.survived,
        firstKill: stats.firstKill,
        firstDeath: stats.firstDeath,
        clutchVs: stats.clutchVs,
        clutchWon: stats.clutchWon,
      });
    }
  }

  // Batch insert
  const batchSize = 500;
  for (let i = 0; i < roundPlayerStatsData.length; i += batchSize) {
    const batch = roundPlayerStatsData.slice(i, i + batchSize);
    await prisma.roundPlayerStats.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  // Delete cached analysis
  await prisma.analysis.deleteMany({ where: { demoId } });
  console.log(`Deleted cached Analysis records`);

  const duration = Date.now() - startTime;
  console.log(`\n✅ Created ${roundPlayerStatsData.length} RoundPlayerStats in ${duration}ms`);

  // Verify some data
  const sample = await prisma.roundPlayerStats.findMany({
    where: { round: { demoId } },
    take: 5,
  });
  console.log(`\nSample data:`);
  for (const s of sample) {
    console.log(`  ${s.steamId}: K=${s.kills} D=${s.deaths} A=${s.assists} DMG=${s.damage}`);
  }

  return { recordsCreated: roundPlayerStatsData.length, durationMs: duration };
}

const demoId = process.argv[2] || "2ee5e818-30a0-4465-88f4-d89564da4821";
recomputeRoundPlayerStats(demoId)
  .then((result) => {
    console.log("\nResult:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
