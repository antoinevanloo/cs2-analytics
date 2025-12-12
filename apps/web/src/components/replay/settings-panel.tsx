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
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Settings, Keyboard, Eye, EyeOff, ChevronDown, ChevronUp, RotateCcw, HelpCircle } from "lucide-react";
import {
  useReplayStore,
  PLAYBACK_SPEEDS,
  VIEW_MODE_LABELS,
  INFERNO_QUALITY_LABELS,
  type PlaybackSpeed,
  type ViewMode,
  type InfernoQuality,
} from "@/stores/replay-store";
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
  compact?: boolean;
}

function SettingRow({ label, description, shortcut, children, compact = false }: SettingRowProps) {
  return (
    <div className={cn(
      "flex items-center justify-between",
      compact ? "py-1" : "py-2"
    )}>
      <div className="space-y-0">
        <div className="flex items-center gap-1.5">
          <Label className={cn(
            "font-medium",
            compact ? "text-xs" : "text-sm"
          )}>{label}</Label>
          {shortcut && (
            <kbd className={cn(
              "font-mono bg-muted rounded border",
              compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
            )}>
              {shortcut}
            </kbd>
          )}
        </div>
        {description && (
          <p className={cn(
            "text-muted-foreground",
            compact ? "text-[10px]" : "text-xs"
          )}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

interface SettingsPanelProps {
  className?: string;
  variant?: "inline" | "popover";
  /** Show view mode selector (for V2 headers) */
  showViewModeSelector?: boolean;
  /** Compact mode - less sections, smaller popover */
  compact?: boolean;
}

export function SettingsPanel({
  className,
  variant = "inline",
  showViewModeSelector = false,
  compact = false,
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const {
    playbackSpeed,
    showKillLines,
    showGrenades,
    showTrajectories,
    showPlayerNames,
    showHealthBars,
    showTrails,
    showInfernoZones,
    trailLength,
    infernoZoneOpacity,
    infernoZoneQuality,
    viewportScale,
    viewMode,
    setPlaybackSpeed,
    toggleKillLines,
    toggleGrenades,
    toggleTrajectories,
    togglePlayerNames,
    toggleHealthBars,
    toggleTrails,
    toggleInfernoZones,
    setTrailLength,
    setInfernoZoneOpacity,
    setInfernoZoneQuality,
    setViewport,
    resetViewport,
    setViewMode,
  } = useReplayStore();

  const content = (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* View Mode section - only shown when showViewModeSelector is true */}
      {showViewModeSelector && (
        <div className="space-y-0.5">
          <h4 className={cn(
            "font-semibold uppercase text-muted-foreground tracking-wide",
            compact ? "text-[10px]" : "text-xs"
          )}>
            View Mode
          </h4>
          <SettingRow label="Persona" compact={compact}>
            <Select
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <SelectTrigger className={cn(
                compact ? "w-24 h-6 text-xs" : "w-28 h-8"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(VIEW_MODE_LABELS) as [ViewMode, string][]).map(
                  ([mode, label]) => (
                    <SelectItem key={mode} value={mode} className={compact ? "text-xs" : undefined}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      )}

      {/* Overlays section */}
      <div className="space-y-0.5">
        <h4 className={cn(
          "font-semibold uppercase text-muted-foreground tracking-wide",
          compact ? "text-[10px]" : "text-xs"
        )}>
          Overlays
        </h4>
        <div className={cn(
          "divide-y divide-border",
          compact ? "space-y-0" : "space-y-0.5"
        )}>
          <SettingRow
            label="Kill Lines"
            shortcut={compact ? undefined : "K"}
            description={compact ? undefined : "Show kill connections on map"}
            compact={compact}
          >
            <Switch checked={showKillLines} onCheckedChange={toggleKillLines} className={compact ? "scale-75" : undefined} />
          </SettingRow>

          <SettingRow
            label="Grenades"
            shortcut={compact ? undefined : "G"}
            description={compact ? undefined : "Show grenade detonation effects"}
            compact={compact}
          >
            <Switch checked={showGrenades} onCheckedChange={toggleGrenades} className={compact ? "scale-75" : undefined} />
          </SettingRow>

          <SettingRow
            label="Trajectories"
            shortcut={compact ? undefined : "J"}
            description={compact ? undefined : "Show grenade throw arcs"}
            compact={compact}
          >
            <Switch checked={showTrajectories} onCheckedChange={toggleTrajectories} className={compact ? "scale-75" : undefined} />
          </SettingRow>

          <SettingRow
            label="Player Names"
            shortcut={compact ? undefined : "N"}
            description={compact ? undefined : "Show names above players"}
            compact={compact}
          >
            <Switch checked={showPlayerNames} onCheckedChange={togglePlayerNames} className={compact ? "scale-75" : undefined} />
          </SettingRow>

          <SettingRow
            label="Health Bars"
            shortcut={compact ? undefined : "H"}
            description={compact ? undefined : "Show health above players"}
            compact={compact}
          >
            <Switch checked={showHealthBars} onCheckedChange={toggleHealthBars} className={compact ? "scale-75" : undefined} />
          </SettingRow>

          <SettingRow
            label="Trails"
            shortcut={compact ? undefined : "T"}
            description={compact ? undefined : "Show player movement history"}
            compact={compact}
          >
            <Switch checked={showTrails} onCheckedChange={toggleTrails} className={compact ? "scale-75" : undefined} />
          </SettingRow>

          <SettingRow
            label="Fire Zones"
            shortcut={compact ? undefined : "F"}
            description={compact ? undefined : "Realistic molotov spread zones"}
            compact={compact}
          >
            <Switch checked={showInfernoZones} onCheckedChange={toggleInfernoZones} className={compact ? "scale-75" : undefined} />
          </SettingRow>
        </div>

        {/* Trail length slider - only shown when trails are enabled */}
        {showTrails && (
          <div className="pt-1">
            <SettingRow
              label="Trail Length"
              description={`${Math.round(trailLength * 8 / 64)}s`}
              compact={compact}
            >
              <div className={compact ? "w-16" : "w-24"}>
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

        {/* Fire zone settings - only shown when fire zones are enabled */}
        {showInfernoZones && (
          <div className="pt-1 space-y-1">
            <SettingRow
              label="Fire Opacity"
              description={`${Math.round(infernoZoneOpacity * 100)}%`}
              compact={compact}
            >
              <div className={compact ? "w-16" : "w-24"}>
                <Slider
                  value={[infernoZoneOpacity]}
                  onValueChange={([value]) => setInfernoZoneOpacity(value)}
                  min={0.1}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </SettingRow>
            <SettingRow
              label="Fire Quality"
              description={compact ? undefined : "Higher = more flames"}
              compact={compact}
            >
              <Select
                value={infernoZoneQuality}
                onValueChange={(v) => setInfernoZoneQuality(v as InfernoQuality)}
              >
                <SelectTrigger className={cn(
                  compact ? "w-20 h-6 text-xs" : "w-24 h-8"
                )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(INFERNO_QUALITY_LABELS) as [InfernoQuality, string][]).map(
                    ([quality, label]) => (
                      <SelectItem key={quality} value={quality} className={compact ? "text-xs" : undefined}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </SettingRow>
          </div>
        )}
      </div>

      {/* Playback section - hidden in compact mode (already in bottom bar) */}
      {!compact && (
        <div className="space-y-0.5">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Playback
          </h4>
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
      )}

      {/* View section */}
      <div className="space-y-0.5">
        <h4 className={cn(
          "font-semibold uppercase text-muted-foreground tracking-wide",
          compact ? "text-[10px]" : "text-xs"
        )}>
          View
        </h4>
        <SettingRow
          label="Zoom"
          shortcut={compact ? undefined : "R"}
          compact={compact}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-muted-foreground text-right",
              compact ? "text-[10px] w-8" : "text-xs w-10"
            )}>
              {Math.round(viewportScale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={resetViewport}
              className={cn(
                compact ? "h-5 text-[10px] px-1.5" : "h-7 text-xs"
              )}
            >
              <RotateCcw className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", !compact && "mr-1")} />
              {!compact && "Reset"}
            </Button>
          </div>
        </SettingRow>
      </div>

      {/* Keyboard shortcuts - hidden in compact mode */}
      {!compact && (
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
      )}

      {/* Help link - shown in compact mode only */}
      {compact && (
        <div className="pt-2 border-t">
          <Link
            href="/help#keyboard-shortcuts"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Keyboard shortcuts</span>
          </Link>
        </div>
      )}
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
        <PopoverContent className={cn(compact ? "w-56 p-3" : "w-80")} align="end">
          <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
            <h3 className={cn(
              "font-medium",
              compact ? "text-xs" : "text-sm"
            )}>Settings</h3>
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
