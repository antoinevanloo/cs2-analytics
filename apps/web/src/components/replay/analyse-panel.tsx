"use client";

/**
 * AnalysePanel - Right panel for analyse (analyst) view mode
 *
 * Layout (wireframe reference - Layout C):
 * ┌─────────────────┐
 * │ [Stats][Events][Notes] │ ← Tabs
 * ├─────────────────┤
 * │                 │
 * │  Tab Content    │
 * │                 │
 * └─────────────────┘
 *
 * Features:
 * - Tabbed interface (Stats, Events, Notes)
 * - Stats: Round statistics, economy, player stats
 * - Events: Chronological event list with filters
 * - Notes: Analyst notes (future feature)
 * - Width: 300px
 *
 * Analyst-specific:
 * - Detailed event breakdown
 * - Economy analysis
 * - Quick stats at a glance
 */

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ListOrdered,
  FileText,
  Skull,
  Target,
  DollarSign,
  Shield,
  Bomb,
} from "lucide-react";
import {
  useReplayStore,
  useCurrentFrame,
  type ReplayEvent,
  type PlayerFrame,
  isKillEvent,
  isBombEvent,
} from "@/stores/replay-store";

type TabType = "stats" | "events" | "notes";

interface AnalysePanelProps {
  /** Additional class names */
  className?: string;
}

/**
 * StatsTab - Round statistics display
 */
const StatsTab = React.memo(function StatsTab() {
  const currentFrame = useCurrentFrame();
  const { roundMetadata, events } = useReplayStore();

  // Calculate stats
  const stats = useMemo(() => {
    if (!currentFrame) return null;

    const ctPlayers = currentFrame.players.filter((p) => p.team === 3);
    const tPlayers = currentFrame.players.filter((p) => p.team === 2);

    const ctAlive = ctPlayers.filter((p) => p.isAlive).length;
    const tAlive = tPlayers.filter((p) => p.isAlive).length;

    const ctMoney = ctPlayers.reduce((sum, p) => sum + (p.money || 0), 0);
    const tMoney = tPlayers.reduce((sum, p) => sum + (p.money || 0), 0);

    const ctEquipValue = ctPlayers.reduce((sum, p) => {
      // Rough equipment value estimation
      let value = p.armor > 0 ? (p.hasHelmet ? 1000 : 650) : 0;
      if (p.hasDefuseKit) value += 400;
      return sum + value;
    }, 0);

    const tEquipValue = tPlayers.reduce((sum, p) => {
      let value = p.armor > 0 ? (p.hasHelmet ? 1000 : 650) : 0;
      if (p.hasBomb) value += 0; // Bomb is free
      return sum + value;
    }, 0);

    // Count kills in round
    const kills = events.filter(isKillEvent);
    const ctKills = kills.filter((k) => {
      const victim = currentFrame.players.find((p) => p.steamId === k.victimSteamId);
      return victim?.team === 2; // T died = CT kill
    }).length;
    const tKills = kills.filter((k) => {
      const victim = currentFrame.players.find((p) => p.steamId === k.victimSteamId);
      return victim?.team === 3; // CT died = T kill
    }).length;

    return {
      ct: { alive: ctAlive, total: ctPlayers.length, money: ctMoney, equip: ctEquipValue, kills: ctKills },
      t: { alive: tAlive, total: tPlayers.length, money: tMoney, equip: tEquipValue, kills: tKills },
    };
  }, [currentFrame, events]);

  if (!stats) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Loading stats...
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Round info */}
      {roundMetadata && (
        <div className="text-center pb-2 border-b border-border">
          <div className="text-sm font-medium">Round {roundMetadata.roundNumber}</div>
          {roundMetadata.winReason && (
            <div className={cn(
              "text-xs mt-1 px-2 py-0.5 rounded inline-block",
              roundMetadata.winnerTeam === 3 ? "bg-ct/20 text-ct" : "bg-t/20 text-t"
            )}>
              {roundMetadata.winReason}
            </div>
          )}
        </div>
      )}

      {/* Team comparison */}
      <div className="space-y-3">
        {/* Alive */}
        <StatRow
          label="Alive"
          icon={<Shield className="h-3.5 w-3.5" />}
          ctValue={`${stats.ct.alive}/${stats.ct.total}`}
          tValue={`${stats.t.alive}/${stats.t.total}`}
        />

        {/* Kills */}
        <StatRow
          label="Kills"
          icon={<Skull className="h-3.5 w-3.5" />}
          ctValue={stats.ct.kills}
          tValue={stats.t.kills}
        />

        {/* Money */}
        <StatRow
          label="Team Money"
          icon={<DollarSign className="h-3.5 w-3.5" />}
          ctValue={`$${(stats.ct.money / 1000).toFixed(1)}k`}
          tValue={`$${(stats.t.money / 1000).toFixed(1)}k`}
        />

        {/* Equipment */}
        <StatRow
          label="Equipment"
          icon={<Target className="h-3.5 w-3.5" />}
          ctValue={`$${(stats.ct.equip / 1000).toFixed(1)}k`}
          tValue={`$${(stats.t.equip / 1000).toFixed(1)}k`}
        />
      </div>
    </div>
  );
});

interface StatRowProps {
  label: string;
  icon: React.ReactNode;
  ctValue: string | number;
  tValue: string | number;
}

const StatRow = React.memo(function StatRow({ label, icon, ctValue, tValue }: StatRowProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground w-24">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 flex items-center justify-between">
        <span className="text-ct font-mono text-xs">{ctValue}</span>
        <span className="text-t font-mono text-xs">{tValue}</span>
      </div>
    </div>
  );
});

/**
 * EventsTab - Chronological event list
 */
const EventsTab = React.memo(function EventsTab() {
  const { events, currentTick, roundMetadata } = useReplayStore();

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.tick - b.tick);
  }, [events]);

  const startTick = roundMetadata?.startTick ?? 0;

  const formatTime = (tick: number) => {
    const seconds = Math.max(0, (tick - startTick) / 64);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getEventIcon = (event: ReplayEvent) => {
    if (isKillEvent(event)) return <Skull className="h-3 w-3 text-red-400" />;
    if (isBombEvent(event)) {
      if (event.type === "BOMB_PLANT") return <Bomb className="h-3 w-3 text-t" />;
      if (event.type === "BOMB_DEFUSE") return <Shield className="h-3 w-3 text-ct" />;
      if (event.type === "BOMB_EXPLODE") return <Bomb className="h-3 w-3 text-red-500" />;
    }
    return <Target className="h-3 w-3 text-muted-foreground" />;
  };

  const getEventDescription = (event: ReplayEvent) => {
    if (isKillEvent(event)) {
      return (
        <span>
          <span className="font-medium">{event.attackerName || "?"}</span>
          {event.headshot && <span className="text-yellow-400 ml-1">HS</span>}
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="font-medium">{event.victimName}</span>
        </span>
      );
    }
    if (isBombEvent(event)) {
      if (event.type === "BOMB_PLANT") return `Bomb planted${event.site ? ` at ${event.site}` : ""}`;
      if (event.type === "BOMB_DEFUSE") return `Bomb defused by ${event.playerName || "CT"}`;
      if (event.type === "BOMB_EXPLODE") return "Bomb exploded";
    }
    return event.type;
  };

  if (sortedEvents.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No events in this round
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {sortedEvents.map((event, index) => {
        const isPast = event.tick <= currentTick;
        return (
          <div
            key={`${event.id}-${index}`}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs",
              isPast ? "opacity-100" : "opacity-40"
            )}
          >
            <span className="text-muted-foreground font-mono w-10">
              {formatTime(event.tick)}
            </span>
            {getEventIcon(event)}
            <span className="flex-1 truncate">
              {getEventDescription(event)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/**
 * NotesTab - Analyst notes (placeholder)
 */
const NotesTab = React.memo(function NotesTab() {
  return (
    <div className="p-4 text-center text-muted-foreground text-sm">
      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p>Notes feature coming soon</p>
      <p className="text-xs mt-1">Add observations and annotations</p>
    </div>
  );
});

/**
 * AnalysePanel - Main component
 */
export const AnalysePanel = React.memo(function AnalysePanel({
  className,
}: AnalysePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("stats");

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "stats", label: "Stats", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "events", label: "Events", icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { id: "notes", label: "Notes", icon: <FileText className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside
      className={cn(
        "w-[300px] bg-card border-l border-border flex flex-col",
        "shrink-0",
        className
      )}
    >
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-background text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "stats" && <StatsTab />}
        {activeTab === "events" && <EventsTab />}
        {activeTab === "notes" && <NotesTab />}
      </div>
    </aside>
  );
});

export default AnalysePanel;