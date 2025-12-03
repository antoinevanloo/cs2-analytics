import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function formatKD(kills: number, deaths: number): string {
  if (deaths === 0) return kills.toFixed(2);
  return (kills / deaths).toFixed(2);
}

export function formatADR(damage: number, rounds: number): string {
  if (rounds === 0) return "0.0";
  return (damage / rounds).toFixed(1);
}

export function formatHSP(headshotKills: number, kills: number): string {
  if (kills === 0) return "0%";
  return `${((headshotKills / kills) * 100).toFixed(1)}%`;
}

export function getTeamColor(team: number | string): string {
  if (team === 2 || team === "T") return "text-t";
  if (team === 3 || team === "CT") return "text-ct";
  return "text-muted-foreground";
}

export function getTeamBgColor(team: number | string): string {
  if (team === 2 || team === "T") return "bg-t";
  if (team === 3 || team === "CT") return "bg-ct";
  return "bg-muted";
}

export function tickToTime(tick: number, tickRate: number = 64): string {
  const seconds = tick / tickRate;
  return formatDuration(seconds);
}

export function mapNameToDisplay(mapName: string): string {
  const mapNames: Record<string, string> = {
    de_ancient: "Ancient",
    de_anubis: "Anubis",
    de_dust2: "Dust II",
    de_inferno: "Inferno",
    de_mirage: "Mirage",
    de_nuke: "Nuke",
    de_overpass: "Overpass",
    de_vertigo: "Vertigo",
    de_train: "Train",
    de_cache: "Cache",
  };
  return mapNames[mapName] || mapName;
}

export function roundTypeToDisplay(roundType: string): string {
  const types: Record<string, string> = {
    PISTOL: "Pistol",
    ECO: "Eco",
    FORCE_BUY: "Force",
    FULL_BUY: "Full Buy",
    UNKNOWN: "Unknown",
  };
  return types[roundType] || roundType;
}

export function weaponToIcon(weapon: string): string {
  // Return path to weapon icon
  return `/weapons/${weapon.replace("weapon_", "")}.svg`;
}
