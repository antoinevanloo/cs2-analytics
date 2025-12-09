"use client";

/**
 * CS2WeaponIcons - SVG weapon icons as React components
 *
 * Pattern from Lexogrine cs2-react-hud:
 * https://github.com/lexogrine/cs2-react-hud/blob/main/src/HUD/Weapon/Weapon.tsx
 *
 * ## Approach
 * - SVGs in src/assets/weapons/ imported via @svgr/webpack
 * - Barrel file exports all weapons as React components
 * - Dynamic access by weapon ID with fallback
 *
 * ## Checklist
 * ✓ Extensibilité: Drop SVG in assets/weapons/, add to barrel
 * ✓ Performance: SVG inline, memoized, single render
 * ✓ Exhaustivité: 70 weapons from Lexogrine
 * ✓ Stabilité: Fallback to knife if weapon not found
 */

import React, { FC, SVGProps } from "react";
import { cn } from "@/lib/utils";
import * as Weapons from "@/assets/weapons";

// ============================================================================
// Types
// ============================================================================

type SizePreset = "xs" | "sm" | "md" | "lg" | "xl";
type WeaponComponent = FC<SVGProps<SVGSVGElement>>;

interface WeaponIconProps {
  weapon: string;
  size?: SizePreset | number;
  color?: string;
  className?: string;
}

// ============================================================================
// Size Configuration
// ============================================================================

const SIZE_PRESETS: Record<SizePreset, { width: number; height: number }> = {
  xs: { width: 20, height: 12 },
  sm: { width: 28, height: 16 },
  md: { width: 40, height: 22 },
  lg: { width: 56, height: 32 },
  xl: { width: 80, height: 44 },
};

// ============================================================================
// Weapon Name Normalization
// ============================================================================

const WEAPON_ALIASES: Record<string, string> = {
  // CS2 display names
  "glock-18": "glock",
  "usp-s": "usp_silencer",
  "p2000": "hkp2000",
  "five-seven": "fiveseven",
  "tec-9": "tec9",
  "cz75-auto": "cz75a",
  "desert_eagle": "deagle",
  "r8_revolver": "revolver",
  "mac-10": "mac10",
  "mp5-sd": "mp5sd",
  "ump-45": "ump45",
  "pp-bizon": "bizon",
  "galil_ar": "galilar",
  "ak-47": "ak47",
  "m4a4": "m4a1",
  "m4a1-s": "m4a1_silencer",
  "sg_553": "sg556",
  "ssg_08": "ssg08",
  "scar-20": "scar20",
  "mag-7": "mag7",
  "sawed-off": "sawedoff",
  "zeus_x27": "taser",
  // Common aliases
  "m4": "m4a1",
  "ak": "ak47",
  "deag": "deagle",
  "awm": "awp",
  "usp": "usp_silencer",
  "usps": "usp_silencer",
  "p2k": "hkp2000",
  "scout": "ssg08",
  "auto": "g3sg1",
  "zeus": "taser",
  "nade": "hegrenade",
  "he": "hegrenade",
  "flash": "flashbang",
  "smoke": "smokegrenade",
  "molly": "molotov",
  "inc": "incgrenade",
  "bomb": "c4",
};

/**
 * Normalize weapon name to match barrel file export
 */
function normalizeWeaponName(weapon: string): string {
  if (!weapon) return "knife";

  // Remove weapon_ prefix and normalize
  const name = weapon.toLowerCase().replace("weapon_", "").trim();

  // Check alias first
  if (WEAPON_ALIASES[name]) {
    return WEAPON_ALIASES[name];
  }

  // Return as-is if it exists in Weapons
  return name;
}

/**
 * Get weapon component from barrel file
 */
function getWeaponComponent(weaponId: string): WeaponComponent | null {
  const component = (Weapons as Record<string, WeaponComponent>)[weaponId];
  return component || null;
}

// ============================================================================
// Components
// ============================================================================

export const CS2WeaponIcon = React.memo(function CS2WeaponIcon({
  weapon,
  size = "sm",
  color = "currentColor",
  className,
}: WeaponIconProps) {
  const weaponId = normalizeWeaponName(weapon);
  const WeaponSVG = getWeaponComponent(weaponId);

  // Fallback to knife if weapon not found
  const FallbackSVG = WeaponSVG || getWeaponComponent("knife");

  if (!FallbackSVG) {
    // Ultimate fallback - simple rectangle
    return (
      <svg
        viewBox="0 0 40 20"
        width={typeof size === "number" ? size : SIZE_PRESETS[size].width}
        height={typeof size === "number" ? size * 0.5 : SIZE_PRESETS[size].height}
        fill={color}
        className={cn("flex-shrink-0", className)}
      >
        <rect x="2" y="4" width="36" height="12" rx="2" />
      </svg>
    );
  }

  const dimensions = typeof size === "number"
    ? { width: size, height: Math.round(size * 0.55) }
    : SIZE_PRESETS[size];

  return (
    <FallbackSVG
      width={dimensions.width}
      height={dimensions.height}
      fill={color}
      className={cn("flex-shrink-0", className)}
      aria-label={weaponId}
    />
  );
});

// ============================================================================
// Equipment Badge
// ============================================================================

interface EquipmentBadgeProps {
  type: "c4" | "defuser" | "kevlar" | "helmet";
  className?: string;
}

const EQUIPMENT_CONFIG: Record<string, { color: string; label: string }> = {
  c4: { color: "text-red-400", label: "Bomb" },
  defuser: { color: "text-green-400", label: "Defuse Kit" },
  kevlar: { color: "text-blue-400", label: "Kevlar" },
  helmet: { color: "text-blue-400", label: "Helmet" },
};

export const EquipmentBadge = React.memo(function EquipmentBadge({
  type,
  className,
}: EquipmentBadgeProps) {
  const config = EQUIPMENT_CONFIG[type];
  if (!config) return null;

  // Use weapon SVG for c4, simple icons for others
  if (type === "c4") {
    const C4SVG = getWeaponComponent("c4");
    if (C4SVG) {
      return (
        <div
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded border",
            config.color,
            "border-current/30 bg-current/10",
            className
          )}
          title={config.label}
        >
          <C4SVG width={14} height={10} fill="currentColor" />
        </div>
      );
    }
  }

  // Simple SVG paths for other equipment
  const paths: Record<string, string> = {
    defuser: "M6 3h12v3h-3v3h3v9H6V9h3V6H6V3zm3 9h6v6H9z",
    kevlar: "M12 2L4 6v6c0 5.5 3.4 10 8 12 4.6-2 8-6.5 8-12V6l-8-4z",
    helmet: "M5 12a7 7 0 0114 0v6H5v-6z",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center w-5 h-5 rounded border",
        config.color,
        "border-current/30 bg-current/10",
        className
      )}
      title={config.label}
    >
      <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
        <path d={paths[type]} />
      </svg>
    </div>
  );
});

// ============================================================================
// Exports
// ============================================================================

export { normalizeWeaponName, SIZE_PRESETS };
export type { WeaponIconProps, SizePreset };
