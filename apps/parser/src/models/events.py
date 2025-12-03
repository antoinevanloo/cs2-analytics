"""
Exhaustive list of all game events available in demoparser2 for CS2.

This module defines ALL 40+ event types that can be extracted from CS2 demo files,
with complete field definitions for each event type.
"""

from enum import Enum
from typing import Any, Final

from pydantic import BaseModel, Field


class EventCategory(str, Enum):
    """Categories for organizing game events."""

    ROUND = "round"
    COMBAT = "combat"
    BOMB = "bomb"
    UTILITY = "utility"
    ECONOMY = "economy"
    PLAYER = "player"
    GAME = "game"
    CHAT = "chat"


# ============================================================================
# EVENT DEFINITIONS - All events available in demoparser2
# ============================================================================

# Round Events
ROUND_EVENTS: Final[list[str]] = [
    "round_start",              # Round begins
    "round_end",                # Round ends
    "round_freeze_end",         # Freeze time ends
    "round_officially_ended",   # Round completely over
    "round_mvp",                # MVP awarded
    "round_announce_match_start",  # Match start announcement
    "round_announce_last_round_half",  # Last round of half
    "round_announce_match_point",   # Match point announcement
    "round_announce_final",     # Final round announcement
    "round_prestart",           # Pre-round state
    "round_poststart",          # Post-start state
    "cs_round_start_beep",      # Round start beep
    "cs_round_final_beep",      # Final beep before round
]

# Combat Events
COMBAT_EVENTS: Final[list[str]] = [
    "player_death",             # Player killed
    "player_hurt",              # Player damaged
    "player_blind",             # Player flashed
    "other_death",              # Non-player death (chicken, etc.)
    "weapon_fire",              # Weapon fired
    "weapon_reload",            # Weapon reloaded
    "weapon_zoom",              # Weapon zoomed
    "silencer_detach",          # Silencer removed
    "silencer_on",              # Silencer attached
    "item_pickup",              # Item picked up
    "item_remove",              # Item removed/dropped
    "item_equip",               # Item equipped
]

# Bomb Events
BOMB_EVENTS: Final[list[str]] = [
    "bomb_planted",             # Bomb planted
    "bomb_defused",             # Bomb defused
    "bomb_exploded",            # Bomb exploded
    "bomb_dropped",             # Bomb dropped
    "bomb_pickup",              # Bomb picked up
    "bomb_beginplant",          # Planting started
    "bomb_abortplant",          # Planting aborted
    "bomb_begindefuse",         # Defusing started
    "bomb_abortdefuse",         # Defusing aborted
    "bombsite_enter",           # Player entered bombsite
    "bombsite_exit",            # Player left bombsite (CS2)
]

# Grenade/Utility Events
UTILITY_EVENTS: Final[list[str]] = [
    "smokegrenade_detonate",    # Smoke deployed
    "smokegrenade_expired",     # Smoke expired
    "flashbang_detonate",       # Flash detonated
    "hegrenade_detonate",       # HE grenade detonated
    "molotov_detonate",         # Molotov/incendiary detonated
    "decoy_started",            # Decoy started
    "decoy_detonate",           # Decoy detonated/expired
    "decoy_firing",             # Decoy making sounds
    "inferno_startburn",        # Fire started burning
    "inferno_expire",           # Fire expired
    "grenade_thrown",           # Any grenade thrown
]

# Economy Events
ECONOMY_EVENTS: Final[list[str]] = [
    "cs_win_panel_round",       # Win panel with economy info
    "cs_win_panel_match",       # Match win panel
    "announce_phase_end",       # Phase end (economy reset)
]

# Player State Events
PLAYER_EVENTS: Final[list[str]] = [
    "player_spawn",             # Player spawned
    "player_team",              # Player changed team
    "player_connect",           # Player connected
    "player_disconnect",        # Player disconnected
    "player_footstep",          # Footstep sound
    "player_jump",              # Player jumped
    "player_falldamage",        # Fall damage taken
    "enter_buyzone",            # Entered buy zone
    "exit_buyzone",             # Left buy zone
    "enter_bombzone",           # Entered bomb zone
    "exit_bombzone",            # Left bomb zone
    "enter_rescue_zone",        # Entered rescue zone (hostage)
    "exit_rescue_zone",         # Left rescue zone
    "player_given_c4",          # Player received bomb
]

# Game State Events
GAME_EVENTS: Final[list[str]] = [
    "begin_new_match",          # New match started
    "game_start",               # Game started
    "game_end",                 # Game ended
    "game_newmap",              # Map changed
    "server_spawn",             # Server spawned
    "cs_game_disconnected",     # Disconnected from game
    "cs_match_end_restart",     # Match restarted
    "switch_team",              # Teams switched sides
    "match_end_conditions",     # Match end conditions met
    "cs_pre_restart",           # Pre-restart state
    "announce_warmup",          # Warmup announced
    "warmup_end",               # Warmup ended
    "cs_intermission",          # Intermission period
]

# Chat Events
CHAT_EVENTS: Final[list[str]] = [
    "player_chat",              # Player chat message
    "player_say",               # Player say command
    "say_team",                 # Team chat
]

# Hostage Events (for hostage maps)
HOSTAGE_EVENTS: Final[list[str]] = [
    "hostage_follows",          # Hostage following player
    "hostage_hurt",             # Hostage damaged
    "hostage_killed",           # Hostage killed
    "hostage_rescued",          # Hostage rescued
    "hostage_stops_following",  # Hostage stopped following
    "hostage_rescued_all",      # All hostages rescued
    "hostage_call_for_help",    # Hostage calling for help
]

# Vote Events
VOTE_EVENTS: Final[list[str]] = [
    "vote_started",             # Vote started
    "vote_passed",              # Vote passed
    "vote_failed",              # Vote failed
    "vote_cast",                # Vote cast
]

# All events combined
ALL_EVENTS: Final[list[str]] = (
    ROUND_EVENTS
    + COMBAT_EVENTS
    + BOMB_EVENTS
    + UTILITY_EVENTS
    + ECONOMY_EVENTS
    + PLAYER_EVENTS
    + GAME_EVENTS
    + CHAT_EVENTS
    + HOSTAGE_EVENTS
    + VOTE_EVENTS
)

# Events critical for match analysis
ESSENTIAL_EVENTS: Final[list[str]] = [
    "round_start",
    "round_end",
    "round_freeze_end",
    "player_death",
    "player_hurt",
    "player_blind",
    "weapon_fire",
    "bomb_planted",
    "bomb_defused",
    "bomb_exploded",
    "bomb_beginplant",
    "bomb_begindefuse",
    "smokegrenade_detonate",
    "flashbang_detonate",
    "hegrenade_detonate",
    "molotov_detonate",
    "inferno_startburn",
    "inferno_expire",
    "grenade_thrown",
    "player_spawn",
    "player_team",
    "round_mvp",
]


# ============================================================================
# EVENT FIELD SCHEMAS - Detailed field definitions for each event
# ============================================================================

class BaseEvent(BaseModel):
    """Base class for all game events."""

    event_name: str
    tick: int
    game_time: float | None = None


class PlayerDeathEvent(BaseEvent):
    """Player death event with full details."""

    event_name: str = "player_death"
    attacker_steamid: str | None = None
    attacker_name: str | None = None
    attacker_team: int | None = None
    attacker_X: float | None = None
    attacker_Y: float | None = None
    attacker_Z: float | None = None
    attacker_pitch: float | None = None
    attacker_yaw: float | None = None

    victim_steamid: str
    victim_name: str
    victim_team: int
    victim_X: float
    victim_Y: float
    victim_Z: float

    assister_steamid: str | None = None
    assister_name: str | None = None

    weapon: str
    weapon_skin: str | None = None
    headshot: bool = False
    penetrated: int = 0  # Wallbang count
    noscope: bool = False
    thrusmoke: bool = False
    attackerblind: bool = False
    is_bomb_planted: bool = False
    distance: float | None = None

    # Additional context
    dominated: bool = False
    revenge: bool = False
    assistedflash: bool = False
    is_suicide: bool = False


class PlayerHurtEvent(BaseEvent):
    """Player hurt event with damage details."""

    event_name: str = "player_hurt"
    attacker_steamid: str | None = None
    attacker_name: str | None = None
    attacker_team: int | None = None
    attacker_X: float | None = None
    attacker_Y: float | None = None
    attacker_Z: float | None = None

    victim_steamid: str
    victim_name: str
    victim_team: int
    victim_X: float
    victim_Y: float
    victim_Z: float

    weapon: str
    damage_health: int
    damage_armor: int
    health_remaining: int
    armor_remaining: int
    hitgroup: int  # 1=head, 2=chest, 3=stomach, 4=left arm, 5=right arm, 6=left leg, 7=right leg


class WeaponFireEvent(BaseEvent):
    """Weapon fire event."""

    event_name: str = "weapon_fire"
    steamid: str
    player_name: str
    team: int
    X: float
    Y: float
    Z: float
    pitch: float
    yaw: float
    weapon: str
    silenced: bool = False


class PlayerBlindEvent(BaseEvent):
    """Player blind (flashed) event."""

    event_name: str = "player_blind"
    attacker_steamid: str | None = None
    attacker_name: str | None = None
    attacker_team: int | None = None

    victim_steamid: str
    victim_name: str
    victim_team: int

    blind_duration: float
    is_teammate_flash: bool = False


class BombPlantedEvent(BaseEvent):
    """Bomb planted event."""

    event_name: str = "bomb_planted"
    planter_steamid: str
    planter_name: str
    planter_team: int
    site: str  # "A" or "B"
    X: float
    Y: float
    Z: float


class BombDefusedEvent(BaseEvent):
    """Bomb defused event."""

    event_name: str = "bomb_defused"
    defuser_steamid: str
    defuser_name: str
    defuser_team: int
    site: str
    with_kit: bool


class BombExplodedEvent(BaseEvent):
    """Bomb exploded event."""

    event_name: str = "bomb_exploded"
    site: str
    planter_steamid: str | None = None


class GrenadeDetonateEvent(BaseEvent):
    """Base class for grenade events."""

    thrower_steamid: str
    thrower_name: str
    thrower_team: int
    X: float
    Y: float
    Z: float


class SmokeGrenadeEvent(GrenadeDetonateEvent):
    """Smoke grenade event."""

    event_name: str = "smokegrenade_detonate"


class FlashbangEvent(GrenadeDetonateEvent):
    """Flashbang event."""

    event_name: str = "flashbang_detonate"
    players_blinded: list[str] = Field(default_factory=list)


class HEGrenadeEvent(GrenadeDetonateEvent):
    """HE grenade event."""

    event_name: str = "hegrenade_detonate"
    damage_dealt: int = 0
    players_damaged: list[str] = Field(default_factory=list)


class MolotovEvent(GrenadeDetonateEvent):
    """Molotov/incendiary event."""

    event_name: str = "molotov_detonate"
    is_incendiary: bool = False


class InfernoEvent(BaseEvent):
    """Inferno (fire) event."""

    X: float
    Y: float
    Z: float
    unique_id: int


class RoundStartEvent(BaseEvent):
    """Round start event."""

    event_name: str = "round_start"
    round_number: int
    timelimit: int
    objective: str | None = None


class RoundEndEvent(BaseEvent):
    """Round end event."""

    event_name: str = "round_end"
    round_number: int
    winner_team: int  # 2=T, 3=CT
    reason: int
    message: str
    ct_score: int
    t_score: int


class RoundMVPEvent(BaseEvent):
    """Round MVP event."""

    event_name: str = "round_mvp"
    steamid: str
    player_name: str
    team: int
    reason: int  # 1=most kills, 2=bomb plant, 3=bomb defuse


class PlayerSpawnEvent(BaseEvent):
    """Player spawn event."""

    event_name: str = "player_spawn"
    steamid: str
    player_name: str
    team: int


class PlayerTeamEvent(BaseEvent):
    """Player team change event."""

    event_name: str = "player_team"
    steamid: str
    player_name: str
    old_team: int
    new_team: int
    disconnect: bool = False


class ItemPickupEvent(BaseEvent):
    """Item pickup event."""

    event_name: str = "item_pickup"
    steamid: str
    player_name: str
    team: int
    item: str
    silent: bool = False
    defindex: int | None = None


class ItemEquipEvent(BaseEvent):
    """Item equip event."""

    event_name: str = "item_equip"
    steamid: str
    player_name: str
    team: int
    item: str
    weptype: int
    hastracers: bool = False
    issilenced: bool = False


class GrenadeProjectile(BaseModel):
    """Grenade trajectory data."""

    grenade_type: str
    thrower_steamid: str
    thrower_name: str
    thrower_team: int
    throw_tick: int
    detonate_tick: int | None = None
    trajectory: list[dict[str, float]] = Field(default_factory=list)  # List of {tick, X, Y, Z}


# Event type mapping
EVENT_MODELS: dict[str, type[BaseEvent]] = {
    "player_death": PlayerDeathEvent,
    "player_hurt": PlayerHurtEvent,
    "weapon_fire": WeaponFireEvent,
    "player_blind": PlayerBlindEvent,
    "bomb_planted": BombPlantedEvent,
    "bomb_defused": BombDefusedEvent,
    "bomb_exploded": BombExplodedEvent,
    "smokegrenade_detonate": SmokeGrenadeEvent,
    "flashbang_detonate": FlashbangEvent,
    "hegrenade_detonate": HEGrenadeEvent,
    "molotov_detonate": MolotovEvent,
    "inferno_startburn": InfernoEvent,
    "round_start": RoundStartEvent,
    "round_end": RoundEndEvent,
    "round_mvp": RoundMVPEvent,
    "player_spawn": PlayerSpawnEvent,
    "player_team": PlayerTeamEvent,
    "item_pickup": ItemPickupEvent,
    "item_equip": ItemEquipEvent,
}


def get_events_by_category(category: EventCategory) -> list[str]:
    """Get all events for a given category."""
    category_map = {
        EventCategory.ROUND: ROUND_EVENTS,
        EventCategory.COMBAT: COMBAT_EVENTS,
        EventCategory.BOMB: BOMB_EVENTS,
        EventCategory.UTILITY: UTILITY_EVENTS,
        EventCategory.ECONOMY: ECONOMY_EVENTS,
        EventCategory.PLAYER: PLAYER_EVENTS,
        EventCategory.GAME: GAME_EVENTS,
        EventCategory.CHAT: CHAT_EVENTS,
    }
    return category_map.get(category, [])


# Hitgroup descriptions
HITGROUP_NAMES: Final[dict[int, str]] = {
    0: "generic",
    1: "head",
    2: "chest",
    3: "stomach",
    4: "left_arm",
    5: "right_arm",
    6: "left_leg",
    7: "right_leg",
    8: "neck",
    10: "gear",
}

# Round end reasons
ROUND_END_REASONS: Final[dict[int, str]] = {
    0: "target_bombed",
    1: "bomb_defused",
    4: "terrorists_win",
    7: "counter_terrorists_win",
    8: "terrorists_surrender",
    9: "counter_terrorists_surrender",
    10: "round_draw",
    12: "hostages_rescued",
    15: "all_hostages_rescued",
    16: "target_saved",
    17: "hostages_not_rescued",
}
