/**
 * Database seed script for development.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create sample players
  const players = await Promise.all([
    prisma.player.upsert({
      where: { steamId: "76561198012345678" },
      update: {},
      create: {
        steamId: "76561198012345678",
        name: "Player1",
        totalMatches: 50,
        totalKills: 650,
        totalDeaths: 500,
        totalAssists: 150,
        totalDamage: 45000,
        totalHsKills: 280,
        totalMvps: 35,
      },
    }),
    prisma.player.upsert({
      where: { steamId: "76561198023456789" },
      update: {},
      create: {
        steamId: "76561198023456789",
        name: "Player2",
        totalMatches: 42,
        totalKills: 480,
        totalDeaths: 420,
        totalAssists: 130,
        totalDamage: 38000,
        totalHsKills: 200,
        totalMvps: 22,
      },
    }),
    prisma.player.upsert({
      where: { steamId: "76561198034567890" },
      update: {},
      create: {
        steamId: "76561198034567890",
        name: "Player3",
        totalMatches: 38,
        totalKills: 520,
        totalDeaths: 380,
        totalAssists: 95,
        totalDamage: 42000,
        totalHsKills: 260,
        totalMvps: 28,
      },
    }),
  ]);

  console.log(`✅ Created ${players.length} players`);

  // Create a sample user
  const user = await prisma.user.upsert({
    where: { email: "demo@cs2analytics.com" },
    update: {},
    create: {
      email: "demo@cs2analytics.com",
      name: "Demo User",
      steamId: "76561198012345678",
      plan: "PRO",
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create a sample team
  const team = await prisma.team.upsert({
    where: { id: "demo-team-1" },
    update: {},
    create: {
      id: "demo-team-1",
      name: "Demo Team",
      tag: "DEMO",
    },
  });

  console.log(`✅ Created team: ${team.name}`);

  // Add user to team
  await prisma.teamMember.upsert({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId: team.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      teamId: team.id,
      role: "OWNER",
    },
  });

  console.log("✅ Added user to team");

  // Seed map metadata for 2D replay (radar coordinates from CS2 game files)
  const mapMetadata = [
    // Active Duty Pool
    {
      mapName: "de_ancient",
      displayName: "Ancient",
      posX: -2953,
      posY: 2164,
      scale: 5,
      gameMode: "competitive",
    },
    {
      mapName: "de_anubis",
      displayName: "Anubis",
      posX: -2796,
      posY: 3328,
      scale: 5.22,
      gameMode: "competitive",
    },
    {
      mapName: "de_dust2",
      displayName: "Dust II",
      posX: -2476,
      posY: 3239,
      scale: 4.4,
      gameMode: "competitive",
    },
    {
      mapName: "de_inferno",
      displayName: "Inferno",
      posX: -2087,
      posY: 3870,
      scale: 4.9,
      gameMode: "competitive",
    },
    {
      mapName: "de_mirage",
      displayName: "Mirage",
      posX: -3230,
      posY: 1713,
      scale: 5,
      gameMode: "competitive",
    },
    {
      mapName: "de_nuke",
      displayName: "Nuke",
      posX: -3453,
      posY: 2887,
      scale: 7,
      hasLowerLevel: true,
      lowerPosX: -3453,
      lowerPosY: 2887,
      lowerScale: 7,
      splitAltitude: -495,
      gameMode: "competitive",
    },
    {
      mapName: "de_overpass",
      displayName: "Overpass",
      posX: -4831,
      posY: 1781,
      scale: 5.2,
      gameMode: "competitive",
    },
    {
      mapName: "de_vertigo",
      displayName: "Vertigo",
      posX: -3168,
      posY: 1762,
      scale: 4,
      hasLowerLevel: true,
      lowerPosX: -3168,
      lowerPosY: 1762,
      lowerScale: 4,
      splitAltitude: 11700,
      gameMode: "competitive",
    },
    // Reserve Pool
    {
      mapName: "de_cache",
      displayName: "Cache",
      posX: -2000,
      posY: 3250,
      scale: 5.5,
      gameMode: "competitive",
    },
    {
      mapName: "de_train",
      displayName: "Train",
      posX: -2477,
      posY: 2392,
      scale: 4.7,
      gameMode: "competitive",
    },
    {
      mapName: "de_cbble",
      displayName: "Cobblestone",
      posX: -3840,
      posY: 3072,
      scale: 6,
      gameMode: "competitive",
    },
    // Wingman maps
    {
      mapName: "de_shortdust",
      displayName: "Shortdust",
      posX: -2318,
      posY: 2337,
      scale: 3.6,
      gameMode: "wingman",
    },
    {
      mapName: "de_shortnuke",
      displayName: "Shortnuke",
      posX: -1620,
      posY: 1434,
      scale: 3.5,
      gameMode: "wingman",
    },
  ];

  for (const map of mapMetadata) {
    await prisma.mapMetadata.upsert({
      where: { mapName: map.mapName },
      update: map,
      create: map,
    });
  }

  console.log(`✅ Created ${mapMetadata.length} map metadata entries`);

  console.log("🎉 Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
