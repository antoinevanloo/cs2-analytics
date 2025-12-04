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
 */

import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { Stage, Layer, Circle, Line, Arrow, Text, Group, Rect } from "react-konva";
import Konva from "konva";
import {
  useReplayStore,
  useCurrentFrame,
  type PlayerFrame,
  type ReplayEvent,
  type MapConfig,
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

// Player rendering constants
const PLAYER_RADIUS = 8;
const VIEW_ANGLE_LENGTH = 20;
const VIEW_ANGLE_SPREAD = 30; // degrees

// Convert game coordinates to canvas coordinates
function gameToCanvas(
  gameX: number,
  gameY: number,
  mapConfig: MapConfig,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Standard CS2 radar coordinate conversion
  const radarX = (gameX - mapConfig.posX) / mapConfig.scale;
  const radarY = (mapConfig.posY - gameY) / mapConfig.scale; // Y is inverted

  // Scale to canvas size
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
  const pos = gameToCanvas(player.x, player.y, mapConfig, canvasWidth, canvasHeight);

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

  // Flash effect
  const flashOpacity = player.flashDuration > 0 ? Math.min(player.flashDuration / 2, 1) * 0.7 : 0;

  // Size multiplier for ducking
  const radius = player.isDucking ? PLAYER_RADIUS * 0.8 : PLAYER_RADIUS;

  return (
    <Group
      onMouseEnter={() => onHover(player.steamId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(player.steamId)}
      onTap={() => onClick(player.steamId)}
    >
      {/* View angle cone */}
      {player.isAlive && (
        <Line
          points={viewPoints}
          closed
          fill={color}
          opacity={0.3}
        />
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
        <Circle
          x={pos.x}
          y={pos.y - radius - 6}
          radius={4}
          fill="#ff4444"
        />
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

      {/* Player name */}
      {showName && (isHovered || isFocused) && player.name && (
        <Text
          x={pos.x - 30}
          y={pos.y + radius + 4}
          width={60}
          text={player.name}
          fontSize={10}
          fill="#ffffff"
          align="center"
        />
      )}

      {/* Health bar */}
      {showHealth && player.isAlive && (isHovered || isFocused) && (
        <Group>
          <Rect
            x={pos.x - 15}
            y={pos.y - radius - 14}
            width={30}
            height={4}
            fill="#333333"
          />
          <Rect
            x={pos.x - 15}
            y={pos.y - radius - 14}
            width={30 * (player.health / 100)}
            height={4}
            fill={player.health > 50 ? "#44ff44" : player.health > 25 ? "#ffff44" : "#ff4444"}
          />
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

  const attackerPos = gameToCanvas(event.x, event.y, mapConfig, canvasWidth, canvasHeight);
  const victimPos = gameToCanvas(event.endX, event.endY, mapConfig, canvasWidth, canvasHeight);

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
  const pos = gameToCanvas(event.x, event.y, mapConfig, canvasWidth, canvasHeight);

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
      <Circle
        x={pos.x}
        y={pos.y}
        radius={8}
        fill="#ff0000"
      />
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

  // Filter active events (within display window)
  const activeEvents = useMemo(() => {
    if (!events || !currentTick) return [];

    // Show kill events for 3 seconds after they occur
    const killDisplayWindow = 64 * 3; // 3 seconds at 64 tick

    return events.filter((event) => {
      if (event.type === "KILL") {
        return (
          showKillLines &&
          currentTick >= event.tick &&
          currentTick <= event.tick + killDisplayWindow
        );
      }
      if (event.type === "BOMB_PLANT") {
        // Show until defused or exploded
        const defuseEvent = events.find(
          (e) =>
            (e.type === "BOMB_DEFUSE" || e.type === "BOMB_EXPLODE") &&
            e.tick > event.tick
        );
        if (defuseEvent) {
          return currentTick >= event.tick && currentTick < defuseEvent.tick;
        }
        return currentTick >= event.tick;
      }
      return false;
    });
  }, [events, currentTick, showKillLines]);

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
    [viewportScale, viewportOffsetX, viewportOffsetY, setViewport]
  );

  // Handle player click
  const handlePlayerClick = useCallback(
    (steamId: string) => {
      focusPlayer(focusedPlayerSteamId === steamId ? null : steamId);
    },
    [focusedPlayerSteamId, focusPlayer]
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
      {/* Background layer (radar image would go here) */}
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill="#1a1a2e" />
      </Layer>

      {/* Events layer */}
      <Layer>
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

      {/* Players layer */}
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
