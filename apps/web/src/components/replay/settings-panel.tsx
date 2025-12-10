"use client";

/**
 * SettingsPanel - Configurable display settings for 2D replay
 *
 * Features:
 * - Toggle overlays (kill lines, grenades, names, health)
 * - Playback speed control
 * - Visual customization options
 * - Keyboard shortcut hints
 * - Collapsible panel
 *
 * Design:
 * - Paramètrable: All display elements can be toggled
 * - Accessible: Clear labels and keyboard shortcuts
 * - Mobile-ready: Collapsible on small screens
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Settings, Keyboard, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { useReplayStore, PLAYBACK_SPEEDS, type PlaybackSpeed } from "@/stores/replay-store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SettingRowProps {
  label: string;
  description?: string;
  shortcut?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, shortcut, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">
              {shortcut}
            </kbd>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

interface SettingsPanelProps {
  className?: string;
  variant?: "inline" | "popover";
}

export function SettingsPanel({ className, variant = "inline" }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const {
    playbackSpeed,
    showKillLines,
    showGrenades,
    showTrajectories,
    showPlayerNames,
    showHealthBars,
    showTrails,
    trailLength,
    viewportScale,
    setPlaybackSpeed,
    toggleKillLines,
    toggleGrenades,
    toggleTrajectories,
    togglePlayerNames,
    toggleHealthBars,
    toggleTrails,
    setTrailLength,
    setViewport,
    resetViewport,
  } = useReplayStore();

  const content = (
    <div className="space-y-4">
      {/* Overlays section */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Overlays
        </h4>
        <div className="space-y-0.5 divide-y divide-border">
          <SettingRow label="Kill Lines" shortcut="K" description="Show kill connections on map">
            <Switch checked={showKillLines} onCheckedChange={toggleKillLines} />
          </SettingRow>

          <SettingRow label="Grenades" shortcut="G" description="Show grenade detonation effects">
            <Switch checked={showGrenades} onCheckedChange={toggleGrenades} />
          </SettingRow>

          <SettingRow label="Trajectories" shortcut="J" description="Show grenade throw arcs">
            <Switch checked={showTrajectories} onCheckedChange={toggleTrajectories} />
          </SettingRow>

          <SettingRow label="Player Names" shortcut="N" description="Show names above players">
            <Switch checked={showPlayerNames} onCheckedChange={togglePlayerNames} />
          </SettingRow>

          <SettingRow label="Health Bars" shortcut="H" description="Show health above players">
            <Switch checked={showHealthBars} onCheckedChange={toggleHealthBars} />
          </SettingRow>

          <SettingRow label="Movement Trails" shortcut="T" description="Show player movement history">
            <Switch checked={showTrails} onCheckedChange={toggleTrails} />
          </SettingRow>
        </div>

        {/* Trail length slider - only shown when trails are enabled */}
        {showTrails && (
          <div className="pt-2">
            <SettingRow
              label="Trail Length"
              description={`${Math.round(trailLength * 8 / 64)}s of movement history`}
            >
              <div className="w-24">
                <Slider
                  value={[trailLength]}
                  onValueChange={([value]) => setTrailLength(value)}
                  min={10}
                  max={80}
                  step={5}
                  className="w-full"
                />
              </div>
            </SettingRow>
          </div>
        )}
      </div>

      {/* Playback section */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Playback
        </h4>
        <div className="space-y-0.5">
          <SettingRow label="Speed" description="Playback speed multiplier">
            <Select
              value={playbackSpeed.toString()}
              onValueChange={(v) => setPlaybackSpeed(parseFloat(v) as PlaybackSpeed)}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <SelectItem key={speed} value={speed.toString()}>
                    {speed}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </div>

      {/* View section */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          View
        </h4>
        <div className="space-y-2">
          <SettingRow label="Zoom" shortcut="R" description="Reset with R key">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 text-right">
                {Math.round(viewportScale * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetViewport}
                className="h-7 text-xs"
              >
                Reset
              </Button>
            </div>
          </SettingRow>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
          <Keyboard className="w-3 h-3" />
          Shortcuts
        </h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Play/Pause</span>
            <kbd className="px-1 bg-muted rounded">Space</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Next frame</span>
            <kbd className="px-1 bg-muted rounded">→</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Prev frame</span>
            <kbd className="px-1 bg-muted rounded">←</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Skip 10s</span>
            <kbd className="px-1 bg-muted rounded">Shift+→</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Speed 0.25x</span>
            <kbd className="px-1 bg-muted rounded">1</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Speed 1x</span>
            <kbd className="px-1 bg-muted rounded">3</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Speed 2x</span>
            <kbd className="px-1 bg-muted rounded">4</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Speed 4x</span>
            <kbd className="px-1 bg-muted rounded">5</kbd>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === "popover") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className={className}>
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-2">
            <h3 className="font-medium">Display Settings</h3>
            {content}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Settings</span>
            </div>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t">{content}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default SettingsPanel;
