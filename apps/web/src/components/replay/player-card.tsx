"use client";

/**
 * PlayerCard - Enhanced player display card for replay roster
 *
 * Features:
 * - Health bar with color gradient (green -> yellow -> red)
 * - Armor indicator
 * - Active weapon icon + ammo
 * - Equipment indicators (bomb, defuse kit)
 * - Money display
 * - Team color coding
 * - Focus/hover states for interactivity
 *
 * Design inspired by CS Demo Manager 2D viewer
 */

import React from "react";
import { cn } from "@/lib/utils";
import { CS2WeaponIcon, EquipmentBadge } from "./cs2-weapon-icons";
import type { PlayerFrame } from "@/stores/replay-store";

interface PlayerCardProps {
  player: PlayerFrame;
  isFocused: boolean;
  isHovered: boolean;
  onFocus: (steamId: string) => void;
  onHover: (steamId: string | null) => void;
  compact?: boolean;
}

// Health color based on percentage
function getHealthColor(health: number): string {
  if (health > 75) return "bg-green-500";
  if (health > 50) return "bg-lime-500";
  if (health > 25) return "bg-yellow-500";
  return "bg-red-500";
}

// Health bar background color
function getHealthBgColor(health: number): string {
  if (health > 75) return "bg-green-500/20";
  if (health > 50) return "bg-lime-500/20";
  if (health > 25) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

export const PlayerCard = React.memo(function PlayerCard({
  player,
  isFocused,
  isHovered,
  onFocus,
  onHover,
  compact = false,
}: PlayerCardProps) {
  const isCT = player.team === 3;
  const teamColor = isCT ? "blue" : "orange";
  const teamColorClass = isCT ? "border-l-blue-500" : "border-l-orange-500";
  const teamBgClass = isCT ? "bg-blue-500/5" : "bg-orange-500/5";

  // Format money with $ and K for thousands
  const formatMoney = (money: number): string => {
    if (money >= 1000) {
      return `$${(money / 1000).toFixed(1)}k`;
    }
    return `$${money}`;
  };

  if (compact) {
    // Compact variant for smaller screens
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-150",
          "border-l-2",
          teamColorClass,
          isFocused && "ring-1 ring-primary bg-primary/10",
          isHovered && !isFocused && "bg-muted/50",
          !player.isAlive && "opacity-40"
        )}
        onClick={() => onFocus(isFocused ? "" : player.steamId)}
        onMouseEnter={() => onHover(player.steamId)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Health indicator */}
        <div
          className={cn(
            "w-8 h-6 rounded text-xs font-bold flex items-center justify-center",
            player.isAlive ? getHealthBgColor(player.health) : "bg-muted",
            player.isAlive ? "text-white" : "text-muted-foreground"
          )}
        >
          {player.isAlive ? player.health : "X"}
        </div>

        {/* Name */}
        <span className={cn("flex-1 truncate text-sm font-medium", !player.isAlive && "line-through")}>
          {player.name || player.steamId.slice(-8)}
        </span>

        {/* Money */}
        <span className="text-xs text-muted-foreground font-mono">
          {formatMoney(player.money)}
        </span>
      </div>
    );
  }

  // Full variant
  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
        "border border-border/50",
        "border-l-3",
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
      {/* Main content */}
      <div className="p-2 space-y-1.5">
        {/* Top row: Health badge + Name + Money */}
        <div className="flex items-center gap-2">
          {/* Health badge */}
          <div
            className={cn(
              "min-w-[32px] h-7 rounded flex items-center justify-center font-bold text-sm",
              player.isAlive ? getHealthBgColor(player.health) : "bg-muted",
              "border",
              player.isAlive
                ? player.health > 75
                  ? "border-green-500/30"
                  : player.health > 50
                    ? "border-lime-500/30"
                    : player.health > 25
                      ? "border-yellow-500/30"
                      : "border-red-500/30"
                : "border-muted-foreground/20"
            )}
          >
            {player.isAlive ? (
              <span className={cn(
                player.health > 50 ? "text-white" : player.health > 25 ? "text-yellow-100" : "text-red-100"
              )}>
                {player.health}
              </span>
            ) : (
              <span className="text-muted-foreground">X</span>
            )}
          </div>

          {/* Name + Equipment */}
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span
              className={cn(
                "font-medium text-sm truncate",
                !player.isAlive && "line-through text-muted-foreground"
              )}
            >
              {player.name || player.steamId.slice(-8)}
            </span>

            {/* Equipment icons inline with name */}
            {player.isAlive && (player.hasBomb || (player.hasDefuseKit && isCT)) && (
              <div className="flex items-center gap-0.5 ml-auto">
                {player.hasBomb && <EquipmentBadge type="c4" />}
                {player.hasDefuseKit && isCT && <EquipmentBadge type="defuser" />}
              </div>
            )}
          </div>

          {/* Money */}
          <div
            className={cn(
              "text-sm font-mono px-1.5 py-0.5 rounded",
              player.money >= 4000
                ? "text-green-400 bg-green-500/10"
                : player.money >= 2000
                  ? "text-yellow-400 bg-yellow-500/10"
                  : "text-red-400 bg-red-500/10"
            )}
          >
            {formatMoney(player.money)}
          </div>
        </div>

        {/* Health bar (only when alive) */}
        {player.isAlive && (
          <div className="relative h-1 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-300", getHealthColor(player.health))}
              style={{ width: `${player.health}%` }}
            />
            {/* Armor overlay */}
            {player.armor > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-blue-400/40"
                style={{ width: `${player.armor}%` }}
              />
            )}
          </div>
        )}

        {/* Bottom row: Weapon + Armor */}
        {player.isAlive && (
          <div className="flex items-center justify-between gap-2">
            {/* Active weapon */}
            <div className="flex items-center gap-1.5">
              {player.activeWeapon && (
                <>
                  <CS2WeaponIcon
                    weapon={player.activeWeapon}
                    size="md"
                    color={isCT ? "#5d79ae" : "#de9b35"}
                  />
                  {player.weaponAmmo !== undefined && player.weaponAmmo !== null && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {player.weaponAmmo}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Armor value */}
            {player.armor > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-400">
                <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
                  <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 8 3.5-1.5 6-4.5 6-8V4L8 1z" />
                </svg>
                <span>{player.armor}</span>
              </div>
            )}
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

      {/* Focus indicator */}
      {isFocused && (
        <div className="absolute inset-0 pointer-events-none border-2 border-primary rounded-lg" />
      )}
    </div>
  );
});

export default PlayerCard;
