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
