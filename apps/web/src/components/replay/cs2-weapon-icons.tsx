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
  // CS2 display names - Pistols
  "glock-18": "glock",
  "usp-s": "usp_silencer",
  "p2000": "hkp2000",
  "five-seven": "fiveseven",
  "tec-9": "tec9",
  "cz75-auto": "cz75a",
  "desert eagle": "deagle",
  "desert_eagle": "deagle",
  "r8 revolver": "revolver",
  "r8_revolver": "revolver",
  "dual berettas": "elite",
  // CS2 display names - SMGs
  "mac-10": "mac10",
  "mp5-sd": "mp5sd",
  "ump-45": "ump45",
  "pp-bizon": "bizon",
  // CS2 display names - Rifles
  "galil ar": "galilar",
  "galil_ar": "galilar",
  "ak-47": "ak47",
  "m4a4": "m4a1",
  "m4a1-s": "m4a1_silencer",
  "sg 553": "sg556",
  "sg_553": "sg556",
  "ssg 08": "ssg08",
  "ssg_08": "ssg08",
  "scar-20": "scar20",
  // CS2 display names - Shotguns
  "mag-7": "mag7",
  "sawed-off": "sawedoff",
  // CS2 display names - Equipment
  "zeus x27": "taser",
  "zeus_x27": "taser",
  "c4 explosive": "c4",
  // CS2 display names - Grenades (from demoparser2)
  "high explosive grenade": "hegrenade",
  "smoke grenade": "smokegrenade",
  "incendiary grenade": "incgrenade",
  "decoy grenade": "decoy",
  // CS2 display names - Knives
  "huntsman knife": "knife_tactical",
  "kukri knife": "knife_cord", // Closest visual match
  "butterfly knife": "knife_butterfly",
  "karambit": "knife_karambit",
  "m9 bayonet": "knife_m9_bayonet",
  "bayonet": "bayonet",
  "flip knife": "knife_flip",
  "gut knife": "knife_gut",
  "falchion knife": "knife_falchion",
  "shadow daggers": "knife_push",
  "bowie knife": "knife_survival_bowie",
  "ursus knife": "knife_ursus",
  "navaja knife": "knife_gypsy_jackknife",
  "stiletto knife": "knife_stiletto",
  "talon knife": "knife_widowmaker",
  "classic knife": "knife_css",
  "paracord knife": "knife_cord",
  "survival knife": "knife_canis",
  "nomad knife": "knife_outdoor",
  "skeleton knife": "knife_skeleton",
  "default ct knife": "knife",
  "default t knife": "knife_t",
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
  size?: "sm" | "md";
  pulsing?: boolean;
  className?: string;
}

const EQUIPMENT_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  c4: { color: "text-red-400", bgColor: "bg-red-500/20", label: "Bomb" },
  defuser: { color: "text-green-400", bgColor: "bg-green-500/20", label: "Defuse Kit" },
  kevlar: { color: "text-blue-400", bgColor: "bg-blue-500/20", label: "Kevlar" },
  helmet: { color: "text-blue-400", bgColor: "bg-blue-500/20", label: "Helmet" },
};

/**
 * Equipment badge with proper icons
 *
 * Uses official Lexogrine CS2 React HUD icons:
 * - C4: Red pulsing badge with bomb icon
 * - Defuser: Green badge with defuse kit icon
 * - Armor: Blue badge with shield
 *
 * @see https://github.com/lexogrine/cs2-react-hud
 */
export const EquipmentBadge = React.memo(function EquipmentBadge({
  type,
  size = "sm",
  pulsing = false,
  className,
}: EquipmentBadgeProps) {
  const config = EQUIPMENT_CONFIG[type];
  if (!config) return null;

  const sizeClasses = size === "md"
    ? "w-6 h-6"
    : "w-5 h-5";

  const iconSize = size === "md"
    ? { width: 16, height: 16 }
    : { width: 14, height: 14 };

  // C4 bomb icon (from Lexogrine cs2-react-hud icon_bomb_default.svg)
  if (type === "c4") {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center rounded border",
          sizeClasses,
          config.color,
          config.bgColor,
          "border-current/40",
          pulsing && "animate-pulse",
          className
        )}
        title={config.label}
      >
        <svg
          viewBox="0 0 256 256"
          width={iconSize.width}
          height={iconSize.height}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M 68 20.469 C 60.759 22.545, 58.164 23.783, 53.341 27.466 C 43.660 34.858, 37.936 46.035, 36.024 61.278 C 34.701 71.835, 34.711 124.817, 36.040 136.500 C 37.471 149.093, 40.626 158.293, 45.353 163.664 C 50.213 169.185, 53.685 171, 59.385 171 C 61.852 171, 65.024 171.439, 66.435 171.975 L 69 172.950 69 203.023 L 69 233.095 71.646 235.548 L 74.292 238 140.557 238 L 206.822 238 209.411 234.923 L 212 231.847 212 185.923 L 212 140 214.566 140 C 215.977 140, 218.002 139.534, 219.066 138.965 C 220.900 137.983, 221 136.619, 221 112.572 C 221 84.776, 221.280 86, 214.918 86 L 212 86 212 67.455 C 212 49.098, 211.975 48.884, 209.545 46.455 L 207.091 44 167.545 44 L 128 44 128 40.559 C 128 38.666, 127.609 36.876, 127.131 36.581 C 126.654 36.286, 125.980 34.275, 125.634 32.113 C 125.081 28.655, 124.448 27.911, 120.376 25.940 C 108.752 20.313, 79.283 17.234, 68 20.469 M 71.800 23.193 C 61.343 24.519, 50.631 31.751, 45.696 40.817 C 39.705 51.825, 38.749 58.465, 38.260 92.500 C 37.402 152.181, 42.607 167.899, 63.250 167.978 L 69 168 69 108.174 L 69 48.349 71.314 46.174 C 73.556 44.068, 74.372 44, 97.314 44 L 121 44 121 40.700 C 121 38.885, 121.475 36.925, 122.055 36.345 C 123.912 34.488, 122.013 30.234, 118.605 28.617 C 109.654 24.369, 85.030 21.516, 71.800 23.193 M 92.440 64.296 C 92.162 65.019, 92.062 71.211, 92.218 78.055 L 92.500 90.500 139.500 90.500 L 186.500 90.500 186.500 77 L 186.500 63.500 139.722 63.240 C 101.799 63.029, 92.849 63.229, 92.440 64.296 M 112 163 L 112 207 149.500 207 L 187 207 187 163 L 187 119 149.500 119 L 112 119 112 163 M 125 132.843 C 125 138.275, 125.760 139, 131.459 139 C 135.684 139, 137.208 137.098, 136.815 132.320 L 136.500 128.500 130.750 128.200 L 125 127.900 125 132.843 M 145.422 129.342 C 145.117 130.138, 145.009 132.524, 145.183 134.645 C 145.493 138.419, 145.591 138.507, 149.824 138.811 C 155.527 139.221, 157.178 137.748, 156.800 132.586 L 156.500 128.500 151.239 128.197 C 147.361 127.974, 145.832 128.275, 145.422 129.342 M 165.254 129.700 C 164.775 130.690, 164.635 133.075, 164.942 135 C 165.470 138.311, 165.734 138.517, 169.824 138.811 C 175.527 139.221, 177.178 137.748, 176.800 132.586 L 176.500 128.500 171.312 128.200 C 167.118 127.957, 165.957 128.245, 165.254 129.700 M 125.196 152.198 L 125.500 157.500 131 157.500 L 136.500 157.500 136.500 152.500 L 136.500 147.500 130.696 147.198 L 124.892 146.897 125.196 152.198 M 145.422 148.342 C 145.117 149.138, 145.009 151.524, 145.183 153.645 C 145.477 157.222, 145.745 157.523, 148.888 157.824 C 150.752 158.002, 153.364 157.875, 154.692 157.541 C 156.878 156.993, 157.078 156.488, 156.803 152.218 L 156.500 147.500 151.239 147.197 C 147.361 146.974, 145.832 147.275, 145.422 148.342 M 165.408 148.150 C 164.467 149.672, 164.403 154.001, 165.287 156.305 C 165.760 157.537, 167.107 157.996, 170.219 157.985 C 176.237 157.963, 177.186 157.088, 176.815 151.901 L 176.500 147.500 171.339 147.201 C 168.007 147.008, 165.906 147.344, 165.408 148.150 M 125.712 166.622 C 125.320 167.013, 125 169.531, 125 172.217 L 125 177.100 130.750 176.800 L 136.500 176.500 136.500 171.500 L 136.500 166.500 131.462 166.205 C 128.690 166.043, 126.103 166.230, 125.712 166.622 M 145.196 171.198 L 145.500 176.500 151 176.500 L 156.500 176.500 156.500 171.500 L 156.500 166.500 150.696 166.198 L 144.892 165.897 145.196 171.198 M 164.928 166.700 C 164.447 172.017, 164.709 175.346, 165.672 176.144 C 166.317 176.679, 169.017 176.977, 171.672 176.808 L 176.500 176.500 176.500 171.500 L 176.500 166.500 170.750 166.200 C 167.588 166.035, 164.967 166.260, 164.928 166.700 M 126.250 185.662 C 125.485 185.971, 125 188.096, 125 191.133 L 125 196.100 130.750 195.800 L 136.500 195.500 136.815 191.099 C 137.018 188.255, 136.665 186.403, 135.815 185.864 C 134.399 184.967, 128.294 184.837, 126.250 185.662 M 146.185 185.864 C 145.335 186.403, 144.982 188.255, 145.185 191.099 L 145.500 195.500 151 195.500 L 156.500 195.500 156.815 191.680 C 156.988 189.579, 156.595 187.217, 155.942 186.430 C 154.656 184.881, 148.316 184.513, 146.185 185.864 M 166.123 185.903 C 164.940 186.652, 164.520 189.712, 164.902 194.800 C 164.973 195.742, 166.581 196.017, 170.750 195.800 L 176.500 195.500 176.815 191.680 C 176.988 189.579, 176.595 187.217, 175.942 186.430 C 174.639 184.860, 168.306 184.520, 166.123 185.903"
          />
        </svg>
        {/* Pulsing ring animation for bomb carrier */}
        {pulsing && (
          <span className="absolute inset-0 rounded border-2 border-red-400 animate-ping opacity-30" />
        )}
      </div>
    );
  }

  // Defuse kit icon (from Lexogrine cs2-react-hud icon_defuse_default.svg)
  if (type === "defuser") {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded border",
          sizeClasses,
          config.color,
          config.bgColor,
          "border-current/40",
          className
        )}
        title={config.label}
      >
        <svg
          viewBox="0 0 256 256"
          width={iconSize.width}
          height={iconSize.height}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M 32.583 20.865 C 31.875 22.012, 35.524 27.305, 50.256 46.500 C 61.896 61.665, 62.731 62.516, 66.268 62.810 C 68.321 62.981, 70 63.596, 70 64.176 C 70 66.427, 62.779 75, 60.883 75 C 58.914 75, 58.605 74.523, 57.620 69.973 C 57.140 67.751, 55.112 66.687, 40.787 61.140 C 9.707 49.106, 10.068 49.215, 8.446 51.418 C 7.354 52.901, 7.300 53.657, 8.208 54.750 C 8.853 55.528, 18.703 63.765, 30.097 73.055 C 47.725 87.429, 51.963 90.403, 58.534 93.013 C 70.146 97.626, 71.305 98.398, 76.063 104.690 C 88.284 120.848, 88.731 122.135, 91.446 148.937 C 92.258 156.947, 93.633 165.865, 94.501 168.756 C 99.529 185.484, 109.758 202.913, 121.130 214.128 C 128.984 221.874, 140.323 230.690, 146.592 233.925 C 150.250 235.813, 151.021 235.895, 153.873 234.696 C 157.940 232.985, 161.217 227.080, 160.805 222.205 C 160.539 219.062, 159.614 217.930, 153.500 213.257 C 143.134 205.334, 136.485 198.454, 130.539 189.500 C 121.417 175.762, 117.281 164.355, 114.523 145.324 C 113.632 139.177, 112.475 132.655, 111.951 130.831 C 111.428 129.006, 111 126.653, 111 125.602 C 111 123.765, 111.077 123.760, 112.963 125.466 C 114.847 127.171, 118 127.001, 118 125.195 C 118 124.718, 115.843 122.590, 113.207 120.466 C 109.116 117.170, 98.749 103.700, 97.805 100.453 C 97.637 99.877, 98.709 97.964, 100.187 96.201 L 102.873 92.997 110.187 95.637 C 117.005 98.098, 118.245 98.233, 128.500 97.631 C 134.550 97.275, 143.775 96.316, 149 95.499 C 176.970 91.126, 196.644 95.711, 226.587 113.578 C 236.949 119.761, 241.180 120.470, 245.506 116.748 C 249.320 113.468, 249.992 107.236, 246.842 104.363 C 242.709 100.593, 222.787 87.398, 213.500 82.280 C 199.005 74.293, 191.809 72.835, 167.044 72.867 C 155.645 72.881, 139.816 73.379, 131.868 73.973 C 117.838 75.020, 117.132 74.978, 107.644 72.512 C 92.311 68.528, 92.069 68.370, 84.022 57.100 C 80.056 51.545, 76.410 47, 75.919 47 C 75.428 47, 66.365 40.925, 55.779 33.500 C 37.712 20.827, 33.893 18.747, 32.583 20.865 M 118.661 103.440 C 117.839 105.583, 121.583 107, 128.065 107 C 136.459 107, 133.582 103.960, 123.801 102.493 C 120.142 101.944, 119.166 102.124, 118.661 103.440 M 114.178 109.687 C 114.623 111.994, 128 115.544, 128 113.354 C 128 111.689, 119.968 108, 116.344 108 C 114.546 108, 113.944 108.469, 114.178 109.687 M 110 113.766 C 110 114.898, 120.536 121, 122.490 121 C 125.406 121, 123.541 118.598, 118.432 115.773 C 113.598 113.101, 110 112.245, 110 113.766"
          />
        </svg>
      </div>
    );
  }

  // SVG paths for armor equipment (simple icons for clarity at small sizes)
  const paths: Record<string, string> = {
    // Kevlar vest - shield icon
    kevlar: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    // Helmet - head protection icon
    helmet: "M12 2C6.48 2 2 6.48 2 12v8h20v-8c0-5.52-4.48-10-10-10zm0 2c4.41 0 8 3.59 8 8v2H4v-2c0-4.41 3.59-8 8-8z",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded border",
        sizeClasses,
        config.color,
        config.bgColor,
        "border-current/40",
        className
      )}
      title={config.label}
    >
      <svg viewBox="0 0 24 24" width={iconSize.width} height={iconSize.height} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
