/**
 * Weapon categorization utilities for CS2 inventory
 *
 * Pure functions for categorizing CS2 weapons from inventory arrays.
 * Supports both internal names (weapon_ak47) and display names (AK-47).
 *
 * ## Extensibility
 * - Add new weapons by extending WEAPON_CATEGORIES Sets
 * - Supports 100+ weapon variants without code changes
 *
 * ## Performance
 * - O(n) complexity for categorization
 * - Set lookups are O(1)
 * - Memoization-friendly (pure functions)
 */

// ============================================================================
// Weapon Categories
// ============================================================================

/**
 * Weapon categories with both internal and display names
 *
 * Internal names: weapon_ak47, knife_butterfly
 * Display names: AK-47, Butterfly Knife
 */
export const WEAPON_CATEGORIES = {
  grenades: new Set([
    // Internal names
    "flashbang", "hegrenade", "smokegrenade", "molotov", "incgrenade", "decoy",
    // Display names from CS2
    "high explosive grenade", "smoke grenade", "incendiary grenade", "decoy grenade",
  ]),
  pistols: new Set([
    // Internal names
    "glock", "hkp2000", "usp_silencer", "p250", "elite", "fiveseven",
    "tec9", "cz75a", "deagle", "revolver",
    // Display names from CS2
    "glock-18", "usp-s", "p2000", "desert eagle", "dual berettas", "five-seven",
    "tec-9", "r8 revolver",
  ]),
  equipment: new Set([
    // Internal names
    "taser", "c4",
    // Display names from CS2
    "zeus x27", "c4 explosive",
  ]),
  // Knives - all variants (internal and display names)
  knives: new Set([
    // Internal names
    "knife", "knife_t", "bayonet", "knife_bayonet", "knife_butterfly",
    "knife_canis", "knife_cord", "knife_css", "knife_falchion", "knife_flip",
    "knife_gut", "knife_gypsy_jackknife", "knife_karambit", "knife_m9_bayonet",
    "knife_outdoor", "knife_push", "knife_skeleton", "knife_stiletto",
    "knife_survival_bowie", "knife_tactical", "knife_ursus", "knife_widowmaker",
    // Display names from CS2 (comprehensive list)
    "huntsman knife", "kukri knife", "karambit", "butterfly knife",
    "falchion knife", "flip knife", "gut knife", "m9 bayonet", "navaja knife",
    "paracord knife", "shadow daggers", "skeleton knife", "stiletto knife",
    "survival knife", "talon knife", "ursus knife", "classic knife", "nomad knife",
    "bowie knife", "default ct knife", "default t knife",
  ]),
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize weapon name for consistent comparison
 * Removes "weapon_" prefix and converts to lowercase
 */
export function normalizeWeaponName(weapon: string): string {
  return weapon.toLowerCase().replace("weapon_", "").trim();
}

/**
 * Check if weapon is a knife (any variant)
 * Supports both internal (knife_butterfly) and display names (Huntsman Knife)
 */
export function isKnife(name: string): boolean {
  const normalized = normalizeWeaponName(name);
  return (
    WEAPON_CATEGORIES.knives.has(normalized) ||
    normalized === "knife" ||
    normalized === "knife_t" ||
    normalized.startsWith("knife_")
  );
}

/**
 * Get weapon category for inventory sorting
 */
export function getWeaponCategory(weapon: string): "primary" | "secondary" | "melee" | "grenade" | "equipment" {
  const name = normalizeWeaponName(weapon);

  if (WEAPON_CATEGORIES.grenades.has(name)) return "grenade";
  if (WEAPON_CATEGORIES.pistols.has(name)) return "secondary";
  if (WEAPON_CATEGORIES.equipment.has(name)) return "equipment";
  if (isKnife(name)) return "melee";

  return "primary";
}

/**
 * Check if weapon type has ammo (excludes melee and taser)
 */
export function weaponHasAmmo(weapon: string): boolean {
  const name = normalizeWeaponName(weapon);
  if (isKnife(name)) return false;
  if (name === "taser" || name === "zeus x27") return false;
  return true;
}

// ============================================================================
// Inventory Categorization
// ============================================================================

/**
 * Grenade with count for display
 * Allows showing "2x flash" etc.
 */
export interface GrenadeSlot {
  weapon: string;
  count: number;
}

export interface CategorizedLoadout {
  primary: string | null;
  secondary: string | null;
  melee: string | null;
  grenades: GrenadeSlot[];
  hasBomb: boolean;
  hasTaser: boolean;
}

/**
 * Grenade display order (standard CS2 buy menu order)
 * Includes both internal and display name variants
 */
const GRENADE_ORDER = [
  "flashbang",
  "hegrenade", "high explosive grenade",
  "smokegrenade", "smoke grenade",
  "molotov", "incgrenade", "incendiary grenade",
  "decoy", "decoy grenade",
];

/**
 * Categorize inventory into weapon slots
 *
 * CS Demo Manager style: Shows ALL grenades with counts
 * - Tracks grenade quantities (2x flash, etc.)
 * - Maintains order: primary → secondary → knife → grenades
 * - Equipment badges separate (bomb, defuser)
 * - Deduplicates weapons (each weapon shown only once)
 *
 * @param inventory - Player's inventory array
 * @param hasBombFlag - Explicit bomb flag from parser
 * @returns Categorized loadout with no duplicates
 */
export function categorizeInventory(inventory?: string[], hasBombFlag?: boolean): CategorizedLoadout {
  const result: CategorizedLoadout = {
    primary: null,
    secondary: null,
    melee: null,
    grenades: [],
    hasBomb: hasBombFlag ?? false,
    hasTaser: false,
  };

  if (!inventory || inventory.length === 0) {
    return result;
  }

  // Track seen weapons to avoid duplicates (normalized names)
  const seenWeapons = new Set<string>();

  // Track grenade counts for display (CS2 allows multiple of same type)
  const grenadeCounts = new Map<string, { weapon: string; count: number }>();

  for (const weapon of inventory) {
    const name = normalizeWeaponName(weapon);

    // Skip duplicates (same weapon appears multiple times in inventory)
    if (seenWeapons.has(name)) {
      // Exception: grenades can have multiple (2x flash)
      const category = getWeaponCategory(weapon);
      if (category === "grenade") {
        const existing = grenadeCounts.get(name);
        if (existing) {
          existing.count++;
        }
      }
      continue;
    }
    seenWeapons.add(name);

    const category = getWeaponCategory(weapon);

    switch (category) {
      case "primary":
        // Only first primary (player can only have one)
        if (!result.primary) {
          result.primary = weapon;
        }
        break;

      case "secondary":
        // Only first secondary
        if (!result.secondary) {
          result.secondary = weapon;
        }
        break;

      case "melee":
        // Only first knife
        if (!result.melee) {
          result.melee = weapon;
        }
        break;

      case "grenade":
        // Track count for each grenade type (CS2: max 1 smoke, 2 flash, 1 molly, 1 HE, 1 decoy)
        grenadeCounts.set(name, { weapon, count: 1 });
        break;

      case "equipment":
        // Check for bomb (both internal "c4" and display "c4 explosive")
        if (name === "c4" || name === "c4 explosive") {
          result.hasBomb = true;
        } else if (name === "taser" || name === "zeus x27") {
          result.hasTaser = true;
        }
        break;
    }
  }

  // Convert grenade map to array with counts
  // Order: flash, HE, smoke, molly/inc, decoy (standard CS2 buy order)
  const sortedGrenades: GrenadeSlot[] = [];
  const addedGrenades = new Set<string>();

  for (const grenadeType of GRENADE_ORDER) {
    const slot = grenadeCounts.get(grenadeType);
    if (slot && !addedGrenades.has(slot.weapon)) {
      sortedGrenades.push(slot);
      addedGrenades.add(slot.weapon);
    }
  }

  result.grenades = sortedGrenades;
  return result;
}
