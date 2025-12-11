/**
 * Replay components module
 *
 * Provides 2D replay visualization for CS2 demo analysis
 */

// Main viewer
export { ReplayViewer } from "./replay-viewer";
export { ReplayViewerEnhanced } from "./replay-viewer-enhanced";
export { ReplayViewerCompact } from "./replay-viewer-compact";
export { ReplayViewerV2Wrapper } from "./ReplayViewerV2Wrapper";
export { ReplayCanvas } from "./replay-canvas";
export { ReplayControls } from "./replay-controls";

// Legacy components (kept for compatibility)
export { ReplayTimeline } from "./replay-timeline";
export { ReplayPlayerList } from "./replay-player-list";

// Enhanced components (new UI)
export { EnhancedTimeline } from "./enhanced-timeline";
export { RosterPanel } from "./roster-panel";
export { PlayerCard } from "./player-card";
export { KillFeed } from "./kill-feed";
export { RoundHeader } from "./round-header";
export { SettingsPanel } from "./settings-panel";

// Compact mode components (V2)
export { CompactHeader } from "./compact-header";
export { FloatingRoster } from "./floating-roster";
export { CompactBottomBar } from "./compact-bottom-bar";

// Weapon icons (Lexogrine pattern)
export {
  CS2WeaponIcon,
  EquipmentBadge,
  normalizeWeaponName,
} from "./cs2-weapon-icons";
