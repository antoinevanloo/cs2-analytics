"use client";

import { cn } from "@/lib/utils";
import { tickToTime, getTeamColor } from "@/lib/utils";
import {
  Crosshair,
  Bomb,
  Shield,
  Flame,
  Eye,
  Wind,
  Sparkles,
} from "lucide-react";

interface TimelineEvent {
  tick: number;
  type: string;
  data: Record<string, unknown>;
}

interface RoundTimelineProps {
  events: TimelineEvent[];
  startTick: number;
  endTick: number;
  tickRate?: number;
}

export function RoundTimeline({
  events,
  startTick,
  endTick,
  tickRate = 64,
}: RoundTimelineProps) {
  const totalDuration = endTick - startTick;

  const getEventIcon = (type: string) => {
    switch (type) {
      case "kill":
        return <Crosshair className="h-4 w-4" />;
      case "bomb_planted":
        return <Bomb className="h-4 w-4 text-t" />;
      case "bomb_defused":
        return <Shield className="h-4 w-4 text-ct" />;
      case "flashbang_detonate":
        return <Eye className="h-4 w-4 text-yellow-400" />;
      case "smokegrenade_detonate":
        return <Wind className="h-4 w-4 text-gray-400" />;
      case "hegrenade_detonate":
      case "molotov_detonate":
        return <Flame className="h-4 w-4 text-orange-500" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getEventLabel = (event: TimelineEvent) => {
    const { type, data } = event;

    switch (type) {
      case "kill":
        return `${data.attackerName || "World"} killed ${data.victimName}`;
      case "bomb_planted":
        return `Bomb planted at ${data.site}`;
      case "bomb_defused":
        return `Bomb defused`;
      case "bomb_exploded":
        return `Bomb exploded`;
      case "flashbang_detonate":
        return `Flash (${data.enemiesBlinded || 0} enemies)`;
      case "smokegrenade_detonate":
        return `Smoke`;
      case "hegrenade_detonate":
        return `HE (${data.totalDamage || 0} dmg)`;
      case "molotov_detonate":
        return `Molotov`;
      default:
        return type;
    }
  };

  return (
    <div className="relative">
      {/* Timeline bar */}
      <div className="h-2 bg-muted rounded-full relative">
        {events.map((event, index) => {
          const position =
            ((event.tick - startTick) / totalDuration) * 100;
          return (
            <div
              key={index}
              className="absolute w-3 h-3 -mt-0.5 rounded-full bg-primary transform -translate-x-1/2 cursor-pointer hover:scale-125 transition-transform"
              style={{ left: `${position}%` }}
              title={getEventLabel(event)}
            />
          );
        })}
      </div>

      {/* Time markers */}
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>0:00</span>
        <span>{tickToTime(totalDuration, tickRate)}</span>
      </div>

      {/* Event list */}
      <div className="mt-4 space-y-2">
        {events.map((event, index) => (
          <div
            key={index}
            className="flex items-center gap-3 text-sm p-2 rounded hover:bg-muted/50"
          >
            <span className="text-xs text-muted-foreground w-12">
              {tickToTime(event.tick - startTick, tickRate)}
            </span>
            <span className="text-muted-foreground">
              {getEventIcon(event.type)}
            </span>
            <span>{getEventLabel(event)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Kill feed component
interface Kill {
  tick: number;
  attackerName: string | null;
  attackerTeam: number;
  victimName: string;
  victimTeam: number;
  weapon: string;
  headshot: boolean;
  wallbang: boolean;
  noscope?: boolean;
  thrusmoke?: boolean;
}

export function KillFeed({ kills }: { kills: Kill[] }) {
  return (
    <div className="space-y-1">
      {kills.map((kill, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50"
        >
          <span className={cn("font-medium", getTeamColor(kill.attackerTeam))}>
            {kill.attackerName || "World"}
          </span>

          <div className="flex items-center gap-1">
            {kill.headshot && (
              <span className="text-yellow-500 text-xs">HS</span>
            )}
            {kill.wallbang && (
              <span className="text-purple-500 text-xs">WB</span>
            )}
            {kill.noscope && (
              <span className="text-green-500 text-xs">NS</span>
            )}
            {kill.thrusmoke && (
              <span className="text-gray-400 text-xs">TS</span>
            )}
          </div>

          <span className="text-muted-foreground">
            [{kill.weapon.replace("weapon_", "")}]
          </span>

          <span className={cn("font-medium", getTeamColor(kill.victimTeam))}>
            {kill.victimName}
          </span>
        </div>
      ))}
    </div>
  );
}
