"use client";

/**
 * ReplayCanvas - Konva canvas for 2D replay rendering
 *
 * Features:
 * - Player position rendering with team colors
 * - View angle indicators
 * - Kill lines and grenade overlays
 * - Smooth interpolation between frames
 * - Interactive player selection
 * - Zoom and pan support
 * - Radar map background image
 *
 * Architecture notes:
 * - Uses Konva for 60fps canvas rendering
 * - Coordinate system converts game coords → radar coords → canvas coords
 * - Memoized components prevent unnecessary re-renders
 * - Filters are toggle-based for UX simplicity
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  Stage,
  Layer,
  Circle,
  Line,
  Arrow,
  Text,
  Group,
  Rect,
  Image as KonvaImage,
  Wedge,
} from "react-konva";
import Konva from "konva";
import {
  useReplayStore,
  useCurrentFrame,
  isGrenadeEvent,
  type PlayerFrame,
  type ReplayEvent,
  type MapConfig,
  type ReplayEventType,
} from "@/stores/replay-store";

// Team colors
const TEAM_COLORS = {
  CT: "#5d79ae", // Blue
  T: "#de9b35", // Orange
  CT_DEAD: "#3d4f6e",
  T_DEAD: "#8e6322",
  CT_FOCUSED: "#8fa4d4",
  T_FOCUSED: "#f4c56e",
};

// Grenade colors (CS2 official colors)
const GRENADE_COLORS: Record<string, string> = {
  smoke: "#a0a0a0", // Gray smoke
  flashbang: "#ffff00", // Yellow flash
  hegrenade: "#ff4444", // Red explosive
  molotov: "#ff6600", // Orange fire
  incgrenade: "#ff6600", // Orange fire (CT incendiary)
  decoy: "#44ff44", // Green decoy
};

// Player rendering constants
const PLAYER_RADIUS = 8;
const PLAYER_RADIUS_WALKING = 6.5; // Smaller when walking (shift) for visual distinction
const PLAYER_RADIUS_DUCKING = 6; // Smallest when crouching
const VIEW_ANGLE_LENGTH = 20;
const VIEW_ANGLE_SPREAD = 30; // degrees
const GRENADE_DISPLAY_DURATION = 64 * 5; // 5 seconds at 64 tick

// Movement speed thresholds (game units per second)
const SPEED_WALKING_MAX = 140; // Max walking speed with shift
const SPEED_RUNNING_MIN = 200; // Minimum running speed

// Movement indicator constants
const MOVEMENT_INDICATOR_LENGTH = 12; // Arrow length for movement direction
const MOVEMENT_INDICATOR_MIN_SPEED = 50; // Minimum speed to show indicator

/**
 * Convert radar coordinates to canvas coordinates
 *
 * The API already converts game coords → radar coords (0 to radarWidth/radarHeight).
 * This function simply scales radar coords to fit the canvas dimensions.
 *
 * @param radarX - X position in radar coords (0 to radarWidth, typically 1024)
 * @param radarY - Y position in radar coords (0 to radarHeight, typically 1024)
 * @param mapConfig - Map configuration with radar dimensions
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 */
function radarToCanvas(
  radarX: number,
  radarY: number,
  mapConfig: MapConfig,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // Scale radar coordinates (0-1024) to canvas size
  const scaleX = canvasWidth / mapConfig.radarWidth;
  const scaleY = canvasHeight / mapConfig.radarHeight;

  return {
    x: radarX * scaleX,
    y: radarY * scaleY,
  };
}

// Player marker component
interface PlayerMarkerProps {
  player: PlayerFrame;
  mapConfig: MapConfig;
  canvasWidth: number;
  canvasHeight: number;
  isHovered: boolean;
  isFocused: boolean;
  showName: boolean;
  showHealth: boolean;
  onHover: (steamId: string | null) => void;
  onClick: (steamId: string) => void;
}

const PlayerMarker = React.memo(function PlayerMarker({
  player,
  mapConfig,
  canvasWidth,
  canvasHeight,
  isHovered,
  isFocused,
  showName,
  showHealth,
  onHover,
  onClick,
}: PlayerMarkerProps) {
  const pos = radarToCanvas(
    player.x,
    player.y,
    mapConfig,
    canvasWidth,
    canvasHeight,
  );

  // Determine color based on team and state
  const isCT = player.team === 3;
  let color: string;

  if (!player.isAlive) {
    color = isCT ? TEAM_COLORS.CT_DEAD : TEAM_COLORS.T_DEAD;
  } else if (isFocused || isHovered) {
    color = isCT ? TEAM_COLORS.CT_FOCUSED : TEAM_COLORS.T_FOCUSED;
  } else {
    color = isCT ? TEAM_COLORS.CT : TEAM_COLORS.T;
  }

  // View angle indicator (triangle/arrow pointing direction)
  const yawRad = (player.yaw * Math.PI) / 180;
  const spreadRad = (VIEW_ANGLE_SPREAD * Math.PI) / 180;

  const viewPoints = [
    pos.x,
    pos.y,
    pos.x + Math.cos(yawRad - spreadRad / 2) * VIEW_ANGLE_LENGTH,
    pos.y - Math.sin(yawRad - spreadRad / 2) * VIEW_ANGLE_LENGTH,
    pos.x + Math.cos(yawRad + spreadRad / 2) * VIEW_ANGLE_LENGTH,
    pos.y - Math.sin(yawRad + spreadRad / 2) * VIEW_ANGLE_LENGTH,
  ];

  // Flash effect - use flashAlpha if available (more precise), fallback to flashDuration
  const flashOpacity = player.flashAlpha !== undefined && player.flashAlpha > 0
    ? (player.flashAlpha / 255) * 0.8 // Use precise flashAlpha (0-255)
    : player.flashDuration > 0
      ? Math.min(player.flashDuration / 2, 1) * 0.7 // Fallback to duration-based
      : 0;

  // Calculate movement speed from velocity
  const velocityX = player.velocityX ?? 0;
  const velocityY = player.velocityY ?? 0;
  const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

  // Determine player radius based on state:
  // - Ducking: smallest (6)
  // - Walking (shift): medium (6.5)
  // - Running: largest (8)
  let radius: number;
  if (player.isDucking) {
    radius = PLAYER_RADIUS_DUCKING;
  } else if (player.isWalking || speed < SPEED_WALKING_MAX) {
    radius = PLAYER_RADIUS_WALKING;
  } else {
    radius = PLAYER_RADIUS;
  }

  // Movement direction indicator (arrow showing where player is moving)
  const showMovementIndicator = player.isAlive && speed > MOVEMENT_INDICATOR_MIN_SPEED;
  const movementAngle = Math.atan2(velocityY, velocityX);
  // Normalize arrow length based on speed (caps at running speed)
  const arrowLength = Math.min(speed / SPEED_RUNNING_MIN, 1) * MOVEMENT_INDICATOR_LENGTH;

  return (
    <Group
      onMouseEnter={() => onHover(player.steamId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(player.steamId)}
      onTap={() => onClick(player.steamId)}
    >
      {/* View angle cone */}
      {player.isAlive && (
        <Line points={viewPoints} closed fill={color} opacity={0.3} />
      )}

      {/* Player circle */}
      <Circle
        x={pos.x}
        y={pos.y}
        radius={radius}
        fill={color}
        stroke={isFocused ? "#ffffff" : undefined}
        strokeWidth={isFocused ? 2 : 0}
        opacity={player.isAlive ? 1 : 0.5}
      />

      {/* Flash overlay */}
      {flashOpacity > 0 && (
        <Circle
          x={pos.x}
          y={pos.y}
          radius={radius + 4}
          fill="#ffffff"
          opacity={flashOpacity}
        />
      )}

      {/* Death X marker */}
      {!player.isAlive && (
        <>
          <Line
            points={[pos.x - 5, pos.y - 5, pos.x + 5, pos.y + 5]}
            stroke="#ff0000"
            strokeWidth={2}
          />
          <Line
            points={[pos.x + 5, pos.y - 5, pos.x - 5, pos.y + 5]}
            stroke="#ff0000"
            strokeWidth={2}
          />
        </>
      )}

      {/* Bomb indicator */}
      {player.hasBomb && player.isAlive && (
        <Circle x={pos.x} y={pos.y - radius - 6} radius={4} fill="#ff4444" />
      )}

      {/* Defuse kit indicator */}
      {player.hasDefuseKit && player.isAlive && isCT && (
        <Rect
          x={pos.x - 3}
          y={pos.y - radius - 8}
          width={6}
          height={6}
          fill="#44ff44"
        />
      )}

      {/* Movement direction indicator (arrow showing velocity direction) */}
      {showMovementIndicator && (
        <Arrow
          points={[
            pos.x,
            pos.y,
            pos.x + Math.cos(movementAngle) * arrowLength,
            pos.y - Math.sin(movementAngle) * arrowLength, // Y inverted in canvas
          ]}
          stroke={color}
          strokeWidth={2}
          pointerLength={4}
          pointerWidth={4}
          opacity={0.7}
        />
      )}

      {/* Player name - always visible when toggle is ON */}
      {showName && player.name && (
        <Text
          x={pos.x - 30}
          y={pos.y + radius + 4}
          width={60}
          text={player.name}
          fontSize={10}
          fill="#ffffff"
          align="center"
          opacity={player.isAlive ? 1 : 0.5}
          shadowColor="#000000"
          shadowBlur={2}
          shadowOffset={{ x: 1, y: 1 }}
          shadowOpacity={0.8}
        />
      )}

      {/* Health bar - always visible when toggle is ON and player is alive */}
      {showHealth && player.isAlive && (
        <Group>
          {/* Background bar */}
          <Rect
            x={pos.x - 15}
            y={pos.y - radius - 14}
            width={30}
            height={4}
            fill="#333333"
            cornerRadius={1}
          />
          {/* Health fill */}
          <Rect
            x={pos.x - 15}
            y={pos.y - radius - 14}
            width={30 * (player.health / 100)}
            height={4}
            fill={
              player.health > 50
                ? "#44ff44"
                : player.health > 25
                  ? "#ffff44"
                  : "#ff4444"
            }
            cornerRadius={1}
          />
          {/* Armor indicator (small bar below health) */}
          {player.armor > 0 && (
            <Rect
              x={pos.x - 15}
              y={pos.y - radius - 9}
              width={30 * (player.armor / 100)}
              height={2}
              fill="#5d79ae"
              cornerRadius={1}
            />
          )}
        </Group>
      )}
    </Group>
  );
});

// Kill line component
interface KillLineProps {
  event: ReplayEvent;
  mapConfig: MapConfig;
  canvasWidth: number;
  canvasHeight: number;
  isVisible: boolean;
}

const KillLine = React.memo(function KillLine({
  event,
  mapConfig,
  canvasWidth,
  canvasHeight,
  isVisible,
}: KillLineProps) {
  if (!isVisible || event.endX === undefined || event.endY === undefined) {
    return null;
  }

  const attackerPos = radarToCanvas(
    event.x,
    event.y,
    mapConfig,
    canvasWidth,
    canvasHeight,
  );
  const victimPos = radarToCanvas(
    event.endX,
    event.endY,
    mapConfig,
    canvasWidth,
    canvasHeight,
  );

  const data = event.data as {
    headshot?: boolean;
    weapon?: string;
  };

  return (
    <Group>
      {/* Kill line */}
      <Arrow
        points={[attackerPos.x, attackerPos.y, victimPos.x, victimPos.y]}
        stroke={data.headshot ? "#ff0000" : "#ffffff"}
        strokeWidth={data.headshot ? 2 : 1}
        opacity={0.6}
        pointerLength={6}
        pointerWidth={4}
        dash={[4, 4]}
      />

      {/* Skull at victim position */}
      <Text
        x={victimPos.x - 6}
        y={victimPos.y - 6}
        text="☠"
        fontSize={12}
        fill="#ff0000"
      />
    </Group>
  );
});

// Bomb indicator component
interface BombIndicatorProps {
  event: ReplayEvent;
  mapConfig: MapConfig;
  canvasWidth: number;
  canvasHeight: number;
  currentTick: number;
}

const BombIndicator = React.memo(function BombIndicator({
  event,
  mapConfig,
  canvasWidth,
  canvasHeight,
  currentTick,
}: BombIndicatorProps) {
  const pos = radarToCanvas(
    event.x,
    event.y,
    mapConfig,
    canvasWidth,
    canvasHeight,
  );

  // Pulsing animation based on time
  const timeSincePlant = (currentTick - event.tick) / 64; // Assuming 64 tick
  const pulseRadius = 15 + Math.sin(timeSincePlant * 4) * 5;

  return (
    <Group>
      <Circle
        x={pos.x}
        y={pos.y}
        radius={pulseRadius}
        stroke="#ff0000"
        strokeWidth={2}
        opacity={0.5}
      />
      <Circle x={pos.x} y={pos.y} radius={8} fill="#ff0000" />
      <Text
        x={pos.x - 4}
        y={pos.y - 5}
        text="C4"
        fontSize={8}
        fill="#ffffff"
        fontStyle="bold"
      />
    </Group>
  );
});

// Grenade indicator component
interface GrenadeIndicatorProps {
  event: ReplayEvent;
  mapConfig: MapConfig;
  canvasWidth: number;
  canvasHeight: number;
  currentTick: number;
}

const GrenadeIndicator = React.memo(function GrenadeIndicator({
  event,
  mapConfig,
  canvasWidth,
  canvasHeight,
  currentTick,
}: GrenadeIndicatorProps) {
  const data = event.data as {
    grenadeType?: string;
    throwerName?: string;
    throwerTeam?: number;
  };

  // Determine grenade type from event type or data
  const getGrenadeType = (): string => {
    // First check event type for granular types
    switch (event.type) {
      case "SMOKE_START":
      case "SMOKE_END":
        return "smoke";
      case "MOLOTOV_START":
      case "MOLOTOV_END":
        return "molotov";
      case "HE_EXPLODE":
        return "hegrenade";
      case "FLASH_EFFECT":
        return "flashbang";
      case "GRENADE_THROW":
        // Fall through to check data
        break;
    }
    // Check data for grenadeType
    return data.grenadeType?.toLowerCase() || "hegrenade";
  };

  const grenadeType = getGrenadeType();
  const color = GRENADE_COLORS[grenadeType] || "#ff4444";

  // Calculate position - use end position if available (detonation point), otherwise start
  const x = event.endX ?? event.x;
  const y = event.endY ?? event.y;

  const pos = radarToCanvas(x, y, mapConfig, canvasWidth, canvasHeight);

  // Time-based opacity fade out
  const ticksSinceEvent = currentTick - event.tick;
  const fadeProgress = Math.min(ticksSinceEvent / GRENADE_DISPLAY_DURATION, 1);
  const opacity = Math.max(0.2, 1 - fadeProgress * 0.8);

  // Smoke has expanding radius effect
  if (grenadeType === "smoke") {
    const smokeRadius = Math.min(ticksSinceEvent / 10, 25); // Expand over time
    return (
      <Group opacity={opacity}>
        <Circle
          x={pos.x}
          y={pos.y}
          radius={smokeRadius}
          fill={color}
          opacity={0.4}
        />
        <Circle
          x={pos.x}
          y={pos.y}
          radius={smokeRadius * 0.6}
          fill={color}
          opacity={0.6}
        />
      </Group>
    );
  }

  // Molotov/incendiary has fire spread effect
  if (grenadeType === "molotov" || grenadeType === "incgrenade") {
    const fireRadius = Math.min(ticksSinceEvent / 8, 20);
    return (
      <Group opacity={opacity}>
        <Circle
          x={pos.x}
          y={pos.y}
          radius={fireRadius}
          fill={color}
          opacity={0.5}
        />
        {/* Pulsing inner fire */}
        <Circle
          x={pos.x}
          y={pos.y}
          radius={fireRadius * 0.5 + Math.sin(ticksSinceEvent / 5) * 3}
          fill="#ffaa00"
          opacity={0.7}
        />
      </Group>
    );
  }

  // Flashbang - brief bright flash
  if (grenadeType === "flashbang") {
    const flashOpacity = Math.max(0, 1 - ticksSinceEvent / 30);
    return (
      <Group opacity={flashOpacity}>
        <Circle x={pos.x} y={pos.y} radius={15} fill={color} opacity={0.8} />
        <Circle x={pos.x} y={pos.y} radius={8} fill="#ffffff" opacity={0.9} />
      </Group>
    );
  }

  // HE grenade - explosion effect
  if (grenadeType === "hegrenade") {
    const explosionRadius = Math.min(ticksSinceEvent / 5, 18);
    const explosionOpacity = Math.max(0, 1 - ticksSinceEvent / 40);
    return (
      <Group opacity={explosionOpacity}>
        <Circle
          x={pos.x}
          y={pos.y}
          radius={explosionRadius}
          fill={color}
          opacity={0.6}
        />
        <Circle
          x={pos.x}
          y={pos.y}
          radius={explosionRadius * 0.4}
          fill="#ffff00"
          opacity={0.8}
        />
      </Group>
    );
  }

  // Default - simple circle marker
  return (
    <Circle x={pos.x} y={pos.y} radius={6} fill={color} opacity={opacity} />
  );
});

// Main canvas component
interface ReplayCanvasProps {
  width: number;
  height: number;
  radarImageUrl?: string;
}

export function ReplayCanvas({
  width,
  height,
  radarImageUrl,
}: ReplayCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [radarImage, setRadarImage] = useState<HTMLImageElement | null>(null);

  const currentFrame = useCurrentFrame();
  const {
    mapConfig,
    events,
    currentTick,
    focusedPlayerSteamId,
    hoveredPlayerSteamId,
    viewportScale,
    viewportOffsetX,
    viewportOffsetY,
    showKillLines,
    showGrenades,
    showPlayerNames,
    showHealthBars,
    focusPlayer,
    hoverPlayer,
    setViewport,
  } = useReplayStore();

  // Load radar image when URL changes
  useEffect(() => {
    if (!radarImageUrl) {
      setRadarImage(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setRadarImage(img);
    };
    img.onerror = () => {
      console.warn("Failed to load radar image:", radarImageUrl);
      setRadarImage(null);
    };
    img.src = radarImageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [radarImageUrl]);

  // Filter active events (within display window)
  const activeEvents = useMemo(() => {
    if (!events || currentTick === undefined) return [];

    const killDisplayWindow = 64 * 3; // 3 seconds at 64 tick

    return events.filter((event) => {
      // Kill events - show for 3 seconds
      if (event.type === "KILL") {
        return (
          showKillLines &&
          currentTick >= event.tick &&
          currentTick <= event.tick + killDisplayWindow
        );
      }

      // Bomb plant - show until defused or exploded
      if (event.type === "BOMB_PLANT") {
        const defuseEvent = events.find(
          (e) =>
            (e.type === "BOMB_DEFUSE" || e.type === "BOMB_EXPLODE") &&
            e.tick > event.tick,
        );
        if (defuseEvent) {
          return currentTick >= event.tick && currentTick < defuseEvent.tick;
        }
        return currentTick >= event.tick;
      }

      // Grenade events - show for 5 seconds when filter is ON
      if (isGrenadeEvent(event.type)) {
        return (
          showGrenades &&
          currentTick >= event.tick &&
          currentTick <= event.tick + GRENADE_DISPLAY_DURATION
        );
      }

      return false;
    });
  }, [events, currentTick, showKillLines, showGrenades]);

  // Wheel zoom handler
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewportScale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - viewportOffsetX) / oldScale,
        y: (pointer.y - viewportOffsetY) / oldScale,
      };

      const scaleBy = 1.1;
      const newScale =
        e.evt.deltaY > 0
          ? Math.max(0.5, oldScale / scaleBy)
          : Math.min(4, oldScale * scaleBy);

      const newOffset = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setViewport(newScale, newOffset.x, newOffset.y);
    },
    [viewportScale, viewportOffsetX, viewportOffsetY, setViewport],
  );

  // Handle player click
  const handlePlayerClick = useCallback(
    (steamId: string) => {
      focusPlayer(focusedPlayerSteamId === steamId ? null : steamId);
    },
    [focusedPlayerSteamId, focusPlayer],
  );

  // Render nothing if no data
  if (!currentFrame || !mapConfig) {
    return (
      <div
        className="flex items-center justify-center bg-gray-900"
        style={{ width, height }}
      >
        <span className="text-gray-500">Loading replay data...</span>
      </div>
    );
  }

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={viewportScale}
      scaleY={viewportScale}
      x={viewportOffsetX}
      y={viewportOffsetY}
      draggable
      onWheel={handleWheel}
      onDragEnd={(e) => {
        setViewport(viewportScale, e.target.x(), e.target.y());
      }}
    >
      {/* Background layer - radar image or fallback color */}
      <Layer>
        {radarImage ? (
          <KonvaImage
            image={radarImage}
            x={0}
            y={0}
            width={width}
            height={height}
          />
        ) : (
          <Rect x={0} y={0} width={width} height={height} fill="#1a1a2e" />
        )}
      </Layer>

      {/* Events layer - grenades, bombs, kills */}
      <Layer>
        {/* Grenade indicators (rendered first, below other events) */}
        {activeEvents
          .filter((e) => isGrenadeEvent(e.type))
          .map((event) => (
            <GrenadeIndicator
              key={event.id}
              event={event}
              mapConfig={mapConfig}
              canvasWidth={width}
              canvasHeight={height}
              currentTick={currentTick}
            />
          ))}

        {/* Bomb indicators */}
        {activeEvents
          .filter((e) => e.type === "BOMB_PLANT")
          .map((event) => (
            <BombIndicator
              key={event.id}
              event={event}
              mapConfig={mapConfig}
              canvasWidth={width}
              canvasHeight={height}
              currentTick={currentTick}
            />
          ))}

        {/* Kill lines */}
        {activeEvents
          .filter((e) => e.type === "KILL")
          .map((event) => (
            <KillLine
              key={event.id}
              event={event}
              mapConfig={mapConfig}
              canvasWidth={width}
              canvasHeight={height}
              isVisible={showKillLines}
            />
          ))}
      </Layer>

      {/* Players layer - on top of everything */}
      <Layer>
        {currentFrame.players.map((player) => (
          <PlayerMarker
            key={player.steamId}
            player={player}
            mapConfig={mapConfig}
            canvasWidth={width}
            canvasHeight={height}
            isHovered={hoveredPlayerSteamId === player.steamId}
            isFocused={focusedPlayerSteamId === player.steamId}
            showName={showPlayerNames}
            showHealth={showHealthBars}
            onHover={hoverPlayer}
            onClick={handlePlayerClick}
          />
        ))}
      </Layer>
    </Stage>
  );
}

export default ReplayCanvas;
