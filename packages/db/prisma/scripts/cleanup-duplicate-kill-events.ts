/**
 * Cleanup Script: Remove duplicate KILL events from ReplayEvent table
 *
 * ## Background
 *
 * Previously, KILL events were stored in both:
 * 1. `Kill` table (source of truth, with full metadata)
 * 2. `ReplayEvent` table (duplicate, with less metadata)
 *
 * This caused duplicate kills in the 2D replay viewer.
 *
 * ## What this script does
 *
 * 1. Counts existing KILL events in ReplayEvent table
 * 2. Deletes all ReplayEvent records where type = 'KILL'
 * 3. Reports cleanup statistics
 *
 * ## Usage
 *
 * ```bash
 * cd packages/db
 * DATABASE_URL="postgresql://..." pnpm exec tsx prisma/scripts/cleanup-duplicate-kill-events.ts
 * ```
 *
 * ## Safety
 *
 * - This is a one-way operation (deletes data)
 * - The Kill table is NOT affected (it's the source of truth)
 * - Run with --dry-run first to see what would be deleted
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(60));
  console.log("Cleanup: Remove duplicate KILL events from ReplayEvent");
  console.log("=".repeat(60));

  if (isDryRun) {
    console.log("\n[DRY RUN MODE - No data will be deleted]\n");
  }

  // Count KILL events in ReplayEvent
  const killEventCount = await prisma.replayEvent.count({
    where: { type: "KILL" },
  });

  console.log(`Found ${killEventCount} KILL events in ReplayEvent table`);

  if (killEventCount === 0) {
    console.log("\nNo cleanup needed - no duplicate KILL events found.");
    return;
  }

  // Count total events for context
  const totalEventCount = await prisma.replayEvent.count();
  const otherEventCount = totalEventCount - killEventCount;

  console.log(`Total ReplayEvent records: ${totalEventCount}`);
  console.log(`  - KILL events (to delete): ${killEventCount}`);
  console.log(`  - Other events (to keep): ${otherEventCount}`);

  // Count Kill table for comparison
  const killTableCount = await prisma.kill.count();
  console.log(`\nKill table records: ${killTableCount} (source of truth)`);

  if (isDryRun) {
    console.log("\n[DRY RUN] Would delete", killEventCount, "KILL events");
    console.log("Run without --dry-run to execute cleanup");
    return;
  }

  // Delete KILL events from ReplayEvent
  console.log("\nDeleting KILL events from ReplayEvent...");

  const deleteResult = await prisma.replayEvent.deleteMany({
    where: { type: "KILL" },
  });

  console.log(`Deleted ${deleteResult.count} KILL events`);

  // Verify cleanup
  const remainingKillEvents = await prisma.replayEvent.count({
    where: { type: "KILL" },
  });

  if (remainingKillEvents === 0) {
    console.log("\n[SUCCESS] Cleanup completed successfully");
  } else {
    console.error(`\n[WARNING] ${remainingKillEvents} KILL events still remain`);
  }

  // Final stats
  const finalEventCount = await prisma.replayEvent.count();
  console.log(`\nFinal ReplayEvent count: ${finalEventCount}`);
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
