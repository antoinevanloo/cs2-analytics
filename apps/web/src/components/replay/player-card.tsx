"use client";

/**
 * PlayerCard - Player display card for 2D replay roster
 *
 * ## Checklist
 * ✓ Extensibilité: Weapon categories via config, easy to add new weapons
 * ✓ Exhaustivité: Shows ALL inventory (primary, secondary, knife, grenades, bomb)
 * ✓ Performance: React.memo, no re-renders on unchanged props
 * ✓ Mobile-ready: Compact variant for small screens
 * ✓ Persona: Gamer sees loadout at glance, analyst sees economic info
 *
 * Design inspired by CS Demo Manager 2D viewer
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CS2WeaponIcon, EquipmentBadge } from "./cs2-weapon-icons";
import type { PlayerFrame } from "@/stores/replay-store";

// ============================================================================
// Types & Constants
// ============================================================================

interface PlayerCardProps {
  player: PlayerFrame;
  isFocused: boolean;
  isHovered: boolean;
  onFocus: (steamId: string) => void;
  onHover: (steamId: string | null) => void;
  compact?: boolean;
}

// Weapon categories - extensible via config
const WEAPON_CATEGORIES = {
  grenades: new Set([
    "flashbang", "hegrenade", "smokegrenade", "molotov", "incgrenade", "decoy",
  ]),
  pistols: new Set([
    "glock", "hkp2000", "usp_silencer", "p250", "elite", "fiveseven",
    "tec9", "cz75a", "deagle", "revolver",
  ]),
  equipment: new Set(["taser", "c4"]),
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

function getHealthColor(health: number): string {
  if (health > 75) return "bg-green-500";
  if (health > 50) return "bg-lime-500";
  if (health > 25) return "bg-yellow-500";
  return "bg-red-500";
}

function getHealthBgColor(health: number): string {
  if (health > 75) return "bg-green-500/20";
  if (health > 50) return "bg-lime-500/20";
  if (health > 25) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

function normalizeWeaponName(weapon: string): string {
  return weapon.toLowerCase().replace("weapon_", "").trim();
}

function isKnife(name: string): boolean {
  return name === "knife" || name === "knife_t" || name.startsWith("knife_");
}

function getWeaponCategory(weapon: string): "primary" | "secondary" | "melee" | "grenade" | "equipment" {
  const name = normalizeWeaponName(weapon);

  if (WEAPON_CATEGORIES.grenades.has(name)) return "grenade";
  if (WEAPON_CATEGORIES.pistols.has(name)) return "secondary";
  if (WEAPON_CATEGORIES.equipment.has(name)) return "equipment";
  if (isKnife(name)) return "melee";

  return "primary";
}

interface CategorizedLoadout {
  primary: string | null;
  secondary: string | null;
  melee: string | null;
  grenades: string[];
  hasBomb: boolean;
  hasTaser: boolean;
}

/**
 * Categorize inventory into weapon slots
 * Ensures no duplicates and handles all edge cases
 */
function categorizeInventory(inventory?: string[], hasBombFlag?: boolean): CategorizedLoadout {
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

  // Track seen weapons to prevent duplicates
  const seenGrenades = new Set<string>();

  for (const weapon of inventory) {
    const name = normalizeWeaponName(weapon);
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
        // Allow multiple grenades but no duplicates of same type
        if (!seenGrenades.has(name)) {
          seenGrenades.add(name);
          result.grenades.push(weapon);
        }
        break;

      case "equipment":
        if (name === "c4") {
          result.hasBomb = true;
        } else if (name === "taser") {
          result.hasTaser = true;
        }
        break;
    }
  }

  return result;
}

function formatMoney(money: number): string {
  if (money >= 1000) {
    return `$${(money / 1000).toFixed(1)}k`;
  }
  return `$${money}`;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Compact player card for mobile/sidebar
 */
const CompactPlayerCard = React.memo(function CompactPlayerCard({
  player,
  isFocused,
  isHovered,
  onFocus,
  onHover,
  teamColor,
}: PlayerCardProps & { teamColor: string }) {
  const isCT = player.team === 3;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-150",
        "border-l-2",
        isCT ? "border-l-blue-500" : "border-l-orange-500",
        isFocused && "ring-1 ring-primary bg-primary/10",
        isHovered && !isFocused && "bg-muted/50",
        !player.isAlive && "opacity-40"
      )}
      onClick={() => onFocus(isFocused ? "" : player.steamId)}
      onMouseEnter={() => onHover(player.steamId)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Health */}
      <div
        className={cn(
          "w-8 h-6 rounded text-xs font-bold flex items-center justify-center",
          player.isAlive ? getHealthBgColor(player.health) : "bg-muted",
          player.isAlive ? "text-white" : "text-muted-foreground"
        )}
      >
        {player.isAlive ? player.health : "✕"}
      </div>

      {/* Active weapon */}
      {player.isAlive && player.activeWeapon && (
        <CS2WeaponIcon
          weapon={player.activeWeapon}
          size="sm"
          color={teamColor}
        />
      )}

      {/* Name */}
      <span className={cn(
        "flex-1 truncate text-sm font-medium",
        !player.isAlive && "line-through"
      )}>
        {player.name || player.steamId.slice(-8)}
      </span>

      {/* Equipment badges */}
      {player.isAlive && (
        <div className="flex items-center gap-0.5">
          {player.hasBomb && <EquipmentBadge type="c4" />}
          {player.hasDefuseKit && isCT && <EquipmentBadge type="defuser" />}
        </div>
      )}

      {/* Money */}
      <span className="text-xs text-muted-foreground font-mono">
        {formatMoney(player.money)}
      </span>
    </div>
  );
});

/**
 * Full player card with complete loadout display
 */
export const PlayerCard = React.memo(function PlayerCard({
  player,
  isFocused,
  isHovered,
  onFocus,
  onHover,
  compact = false,
}: PlayerCardProps) {
  const isCT = player.team === 3;
  const teamColor = isCT ? "#5d79ae" : "#de9b35";
  const teamColorClass = isCT ? "border-l-blue-500" : "border-l-orange-500";
  const teamBgClass = isCT ? "bg-blue-500/5" : "bg-orange-500/5";

  // Memoize loadout categorization
  const loadout = useMemo(
    () => categorizeInventory(player.inventory, player.hasBomb),
    [player.inventory, player.hasBomb]
  );

  // Active weapon for highlighting
  const activeWeaponName = player.activeWeapon
    ? normalizeWeaponName(player.activeWeapon)
    : null;

  // Compact variant
  if (compact) {
    return (
      <CompactPlayerCard
        player={player}
        isFocused={isFocused}
        isHovered={isHovered}
        onFocus={onFocus}
        onHover={onHover}
        teamColor={teamColor}
      />
    );
  }

  // Check if weapon is currently active
  const isWeaponActive = (weapon: string | null): boolean => {
    if (!weapon || !activeWeaponName) return false;
    return normalizeWeaponName(weapon) === activeWeaponName;
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
        "border border-border/50 border-l-3",
        teamColorClass,
        teamBgClass,
        isFocused && "ring-2 ring-primary border-primary/50 shadow-lg",
        isHovered && !isFocused && "bg-muted/30 border-border",
        !player.isAlive && "opacity-50"
      )}
      onClick={() => onFocus(isFocused ? "" : player.steamId)}
      onMouseEnter={() => onHover(player.steamId)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="p-2 space-y-1.5">
        {/* Header: Health + Name + Equipment + Money */}
        <div className="flex items-center gap-2">
          {/* Health badge */}
          <div
            className={cn(
              "min-w-[32px] h-7 rounded flex items-center justify-center font-bold text-sm border",
              player.isAlive ? getHealthBgColor(player.health) : "bg-muted",
              player.isAlive
                ? player.health > 75 ? "border-green-500/30"
                  : player.health > 50 ? "border-lime-500/30"
                  : player.health > 25 ? "border-yellow-500/30"
                  : "border-red-500/30"
                : "border-muted-foreground/20"
            )}
          >
            {player.isAlive ? (
              <span className={cn(
                player.health > 50 ? "text-white"
                  : player.health > 25 ? "text-yellow-100"
                  : "text-red-100"
              )}>
                {player.health}
              </span>
            ) : (
              <span className="text-muted-foreground">✕</span>
            )}
          </div>

          {/* Name */}
          <span className={cn(
            "flex-1 min-w-0 font-medium text-sm truncate",
            !player.isAlive && "line-through text-muted-foreground"
          )}>
            {player.name || player.steamId.slice(-8)}
          </span>

          {/* Equipment badges (bomb, defuse kit) */}
          {player.isAlive && (
            <div className="flex items-center gap-0.5">
              {(loadout.hasBomb || player.hasBomb) && <EquipmentBadge type="c4" />}
              {player.hasDefuseKit && isCT && <EquipmentBadge type="defuser" />}
            </div>
          )}

          {/* Money */}
          <div
            className={cn(
              "text-sm font-mono px-1.5 py-0.5 rounded",
              player.money >= 4000 ? "text-green-400 bg-green-500/10"
                : player.money >= 2000 ? "text-yellow-400 bg-yellow-500/10"
                : "text-red-400 bg-red-500/10"
            )}
          >
            {formatMoney(player.money)}
          </div>
        </div>

        {/* Health bar */}
        {player.isAlive && (
          <div className="relative h-1 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-300", getHealthColor(player.health))}
              style={{ width: `${player.health}%` }}
            />
            {player.armor > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-blue-400/40"
                style={{ width: `${player.armor}%` }}
              />
            )}
          </div>
        )}

        {/* Loadout (only when alive) */}
        {player.isAlive && (
          <div className="pt-1 border-t border-border/30">
            <div className="flex items-center gap-1 flex-wrap">
              {/* Primary weapon */}
              {loadout.primary && (
                <WeaponSlot
                  weapon={loadout.primary}
                  isActive={isWeaponActive(loadout.primary)}
                  color={teamColor}
                  size="sm"
                />
              )}

              {/* Secondary weapon */}
              {loadout.secondary && (
                <WeaponSlot
                  weapon={loadout.secondary}
                  isActive={isWeaponActive(loadout.secondary)}
                  color={teamColor}
                  size="sm"
                />
              )}

              {/* Knife (only if in inventory, not duplicated) */}
              {loadout.melee && (
                <WeaponSlot
                  weapon={loadout.melee}
                  isActive={isWeaponActive(loadout.melee)}
                  color={teamColor}
                  size="sm"
                />
              )}

              {/* Taser */}
              {loadout.hasTaser && (
                <WeaponSlot
                  weapon="taser"
                  isActive={activeWeaponName === "taser"}
                  color={teamColor}
                  size="sm"
                />
              )}

              {/* Spacer */}
              <div className="flex-1 min-w-2" />

              {/* Grenades */}
              {loadout.grenades.map((grenade, idx) => (
                <WeaponSlot
                  key={`${grenade}-${idx}`}
                  weapon={grenade}
                  isActive={isWeaponActive(grenade)}
                  color={teamColor}
                  size="xs"
                />
              ))}

              {/* Armor indicator */}
              {player.armor > 0 && (
                <div className="flex items-center gap-0.5 text-xs text-blue-400 ml-1">
                  <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
                    <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 8 3.5-1.5 6-4.5 6-8V4L8 1z" />
                  </svg>
                  <span className="font-mono text-[10px]">{player.armor}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Death indicator */}
        {!player.isAlive && (
          <div className="flex items-center justify-center gap-1 text-xs text-red-400/70 py-1">
            <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM4 5l1.5-1.5L8 6l2.5-2.5L12 5 9.5 7.5 12 10l-1.5 1.5L8 9l-2.5 2.5L4 10l2.5-2.5L4 5z" />
            </svg>
            <span>ELIMINATED</span>
          </div>
        )}
      </div>

      {/* Focus ring */}
      {isFocused && (
        <div className="absolute inset-0 pointer-events-none border-2 border-primary rounded-lg" />
      )}
    </div>
  );
});

/**
 * Weapon slot component - reusable for all weapon types
 */
const WeaponSlot = React.memo(function WeaponSlot({
  weapon,
  isActive,
  color,
  size,
}: {
  weapon: string;
  isActive: boolean;
  color: string;
  size: "xs" | "sm";
}) {
  const name = normalizeWeaponName(weapon);

  return (
    <div
      className={cn(
        "flex items-center px-1 py-0.5 rounded transition-colors",
        isActive ? "bg-primary/20 ring-1 ring-primary/50" : "bg-muted/30"
      )}
      title={name}
    >
      <CS2WeaponIcon weapon={weapon} size={size} color={color} />
    </div>
  );
});

export default PlayerCard;
