/**
 * Unit tests for weapon-utils.ts
 *
 * Run with: npx tsx apps/web/src/lib/weapon-utils.spec.ts
 * Or with Jest: npx jest apps/web/src/lib/weapon-utils.spec.ts
 *
 * ## Test Coverage:
 * - normalizeWeaponName: Internal name normalization
 * - isKnife: Knife detection (internal + display names)
 * - getWeaponCategory: Weapon categorization
 * - weaponHasAmmo: Ammo display logic
 * - categorizeInventory: Full inventory parsing with deduplication
 */

import {
  normalizeWeaponName,
  isKnife,
  getWeaponCategory,
  weaponHasAmmo,
  categorizeInventory,
  type CategorizedLoadout,
} from "./weapon-utils";

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

function describe(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error instanceof Error ? error.message : error}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: T) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, got ${actualStr}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(expected: number) {
      const arr = actual as unknown as unknown[];
      if (arr.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${arr.length}`);
      }
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("normalizeWeaponName", () => {
  it("should remove weapon_ prefix", () => {
    expect(normalizeWeaponName("weapon_ak47")).toBe("ak47");
    expect(normalizeWeaponName("weapon_awp")).toBe("awp");
  });

  it("should lowercase and trim", () => {
    expect(normalizeWeaponName("AK-47")).toBe("ak-47");
    expect(normalizeWeaponName("  Glock-18  ")).toBe("glock-18");
  });

  it("should handle display names", () => {
    expect(normalizeWeaponName("Huntsman Knife")).toBe("huntsman knife");
    expect(normalizeWeaponName("SSG 08")).toBe("ssg 08");
  });
});

describe("isKnife", () => {
  it("should detect internal knife names", () => {
    expect(isKnife("knife")).toBeTruthy();
    expect(isKnife("knife_t")).toBeTruthy();
    expect(isKnife("knife_butterfly")).toBeTruthy();
    expect(isKnife("knife_karambit")).toBeTruthy();
  });

  it("should detect display name knives", () => {
    expect(isKnife("Huntsman Knife")).toBeTruthy();
    expect(isKnife("Kukri Knife")).toBeTruthy();
    expect(isKnife("Karambit")).toBeTruthy();
    expect(isKnife("Butterfly Knife")).toBeTruthy();
    expect(isKnife("M9 Bayonet")).toBeTruthy();
  });

  it("should NOT detect non-knife weapons", () => {
    expect(isKnife("AK-47")).toBeFalsy();
    expect(isKnife("AWP")).toBeFalsy();
    expect(isKnife("Glock-18")).toBeFalsy();
    expect(isKnife("flashbang")).toBeFalsy();
  });
});

describe("getWeaponCategory", () => {
  it("should categorize primary weapons", () => {
    expect(getWeaponCategory("AK-47")).toBe("primary");
    expect(getWeaponCategory("AWP")).toBe("primary");
    expect(getWeaponCategory("M4A4")).toBe("primary");
    expect(getWeaponCategory("SSG 08")).toBe("primary");
  });

  it("should categorize secondary weapons (pistols)", () => {
    expect(getWeaponCategory("Glock-18")).toBe("secondary");
    expect(getWeaponCategory("USP-S")).toBe("secondary");
    expect(getWeaponCategory("Desert Eagle")).toBe("secondary");
    expect(getWeaponCategory("P250")).toBe("secondary");
  });

  it("should categorize melee weapons", () => {
    expect(getWeaponCategory("knife")).toBe("melee");
    expect(getWeaponCategory("Huntsman Knife")).toBe("melee");
    expect(getWeaponCategory("Karambit")).toBe("melee");
  });

  it("should categorize grenades", () => {
    expect(getWeaponCategory("flashbang")).toBe("grenade");
    expect(getWeaponCategory("hegrenade")).toBe("grenade");
    expect(getWeaponCategory("smokegrenade")).toBe("grenade");
    expect(getWeaponCategory("High Explosive Grenade")).toBe("grenade");
    expect(getWeaponCategory("Smoke Grenade")).toBe("grenade");
  });

  it("should categorize equipment", () => {
    expect(getWeaponCategory("taser")).toBe("equipment");
    expect(getWeaponCategory("Zeus x27")).toBe("equipment");
    expect(getWeaponCategory("c4")).toBe("equipment");
    expect(getWeaponCategory("C4 Explosive")).toBe("equipment");
  });
});

describe("weaponHasAmmo", () => {
  it("should return true for firearms", () => {
    expect(weaponHasAmmo("AK-47")).toBeTruthy();
    expect(weaponHasAmmo("AWP")).toBeTruthy();
    expect(weaponHasAmmo("Glock-18")).toBeTruthy();
  });

  it("should return false for knives", () => {
    expect(weaponHasAmmo("knife")).toBeFalsy();
    expect(weaponHasAmmo("Huntsman Knife")).toBeFalsy();
    expect(weaponHasAmmo("Karambit")).toBeFalsy();
  });

  it("should return false for taser", () => {
    expect(weaponHasAmmo("taser")).toBeFalsy();
    expect(weaponHasAmmo("Zeus x27")).toBeFalsy();
  });
});

describe("categorizeInventory", () => {
  it("should return empty loadout for empty inventory", () => {
    const result = categorizeInventory([]);
    expect(result.primary).toBeNull();
    expect(result.secondary).toBeNull();
    expect(result.melee).toBeNull();
    expect(result.grenades).toHaveLength(0);
    expect(result.hasBomb).toBeFalsy();
    expect(result.hasTaser).toBeFalsy();
  });

  it("should return empty loadout for undefined inventory", () => {
    const result = categorizeInventory(undefined);
    expect(result.primary).toBeNull();
    expect(result.secondary).toBeNull();
  });

  it("should categorize a typical loadout", () => {
    const inventory = ["AK-47", "Glock-18", "Huntsman Knife", "flashbang", "smokegrenade"];
    const result = categorizeInventory(inventory);

    expect(result.primary).toBe("AK-47");
    expect(result.secondary).toBe("Glock-18");
    expect(result.melee).toBe("Huntsman Knife");
    expect(result.grenades).toHaveLength(2);
  });

  it("should handle duplicate weapons (no duplication in output)", () => {
    // Simulating inventory that might have duplicates from parser
    const inventory = ["AK-47", "AK-47", "Glock-18", "knife"];
    const result = categorizeInventory(inventory);

    expect(result.primary).toBe("AK-47");
    expect(result.secondary).toBe("Glock-18");
    expect(result.melee).toBe("knife");
  });

  it("should count multiple grenades of same type", () => {
    const inventory = ["flashbang", "flashbang", "smokegrenade", "hegrenade"];
    const result = categorizeInventory(inventory);

    expect(result.grenades).toHaveLength(3);

    const flashSlot = result.grenades.find(g => normalizeWeaponName(g.weapon) === "flashbang");
    expect(flashSlot?.count).toBe(2);

    const smokeSlot = result.grenades.find(g => normalizeWeaponName(g.weapon) === "smokegrenade");
    expect(smokeSlot?.count).toBe(1);
  });

  it("should detect bomb from inventory", () => {
    const inventory = ["AK-47", "C4 Explosive", "knife"];
    const result = categorizeInventory(inventory);

    expect(result.hasBomb).toBeTruthy();
  });

  it("should use hasBombFlag when provided", () => {
    const inventory = ["AK-47", "knife"];
    const result = categorizeInventory(inventory, true);

    expect(result.hasBomb).toBeTruthy();
  });

  it("should detect taser", () => {
    const inventory = ["AK-47", "Zeus x27", "knife"];
    const result = categorizeInventory(inventory);

    expect(result.hasTaser).toBeTruthy();
  });

  it("should handle real CS2 inventory with display names", () => {
    // Real inventory from CS2 parser
    const inventory = [
      "SSG 08",
      "Glock-18",
      "Kukri Knife",
      "Flashbang",
      "Flashbang",
      "High Explosive Grenade",
      "Smoke Grenade",
    ];
    const result = categorizeInventory(inventory);

    expect(result.primary).toBe("SSG 08");
    expect(result.secondary).toBe("Glock-18");
    expect(result.melee).toBe("Kukri Knife");
    expect(result.grenades.length).toBe(3); // flash (x2), HE, smoke
  });

  it("should NOT show knife as primary (previous bug)", () => {
    // This was the bug: knife was categorized as primary, overwriting actual primary
    const inventory = ["AWP", "USP-S", "Huntsman Knife"];
    const result = categorizeInventory(inventory);

    expect(result.primary).toBe("AWP");
    expect(result.melee).toBe("Huntsman Knife");
  });

  it("should sort grenades in CS2 buy order", () => {
    // Order: flash, HE, smoke, molly, decoy
    const inventory = ["smokegrenade", "flashbang", "hegrenade", "molotov", "decoy"];
    const result = categorizeInventory(inventory);

    expect(result.grenades[0]?.weapon).toBe("flashbang");
    expect(result.grenades[1]?.weapon).toBe("hegrenade");
    expect(result.grenades[2]?.weapon).toBe("smokegrenade");
    expect(result.grenades[3]?.weapon).toBe("molotov");
    expect(result.grenades[4]?.weapon).toBe("decoy");
  });
});

// ============================================================================
// Run Tests
// ============================================================================

console.log("\n🧪 Running weapon-utils tests...\n");
console.log("=".repeat(50));

// Summaries
console.log("\n" + "=".repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
