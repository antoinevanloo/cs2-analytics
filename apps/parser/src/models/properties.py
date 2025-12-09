"""
Exhaustive list of all tick-by-tick properties available in demoparser2 for CS2.

This module defines ALL properties that can be extracted from CS2 demo files,
organized by category for clarity and maintainability.
"""

from enum import Enum
from typing import Final


class PropertyCategory(str, Enum):
    """Categories for organizing player properties."""

    IDENTITY = "identity"
    POSITION = "position"
    MOVEMENT = "movement"
    HEALTH = "health"
    ARMOR = "armor"
    WEAPONS = "weapons"
    ECONOMY = "economy"
    COMBAT = "combat"
    UTILITY = "utility"
    GAME_STATE = "game_state"
    TEAM = "team"
    STATISTICS = "statistics"
    FLAGS = "flags"
    ENTITY = "entity"
    CONTROLLER = "controller"
    INVENTORY = "inventory"


# ============================================================================
# IDENTITY PROPERTIES
# ============================================================================
IDENTITY_PROPS: Final[list[str]] = [
    "steamid",              # Player's Steam ID (64-bit)
    "name",                 # Player's display name
    "user_id",              # Server-assigned user ID
    "crosshair_code",       # Player's crosshair settings code
    "clan_name",            # Clan tag
]

# ============================================================================
# POSITION & MOVEMENT PROPERTIES
# ============================================================================
POSITION_PROPS: Final[list[str]] = [
    "X",                    # X coordinate (map position)
    "Y",                    # Y coordinate (map position)
    "Z",                    # Z coordinate (height)
    "pitch",                # Vertical aim angle (up/down)
    "yaw",                  # Horizontal aim angle (rotation)
    "velocity_X",           # Velocity on X axis
    "velocity_Y",           # Velocity on Y axis
    "velocity_Z",           # Velocity on Z axis
]

MOVEMENT_PROPS: Final[list[str]] = [
    "is_walking",           # Walking (shift held)
    "is_strafing",          # Strafing movement
    "is_scoped",            # Using weapon scope
    "is_defusing",          # Defusing bomb
    "is_planting",          # Planting bomb (inferred from activity)
    "ducking",              # Crouching state
    "ducked",               # Fully crouched
    "duck_amount",          # Duck progress (0-1)
    "in_duck_jump",         # Duck jumping
    "last_place_name",      # Current map location callout
]

# ============================================================================
# HEALTH & ARMOR PROPERTIES
# ============================================================================
HEALTH_PROPS: Final[list[str]] = [
    "health",               # Current health (0-100)
    "life_state",           # Alive/dead/dying state
    "is_alive",             # Boolean alive check
]

ARMOR_PROPS: Final[list[str]] = [
    "armor_value",          # Current armor points (0-100)
    "has_helmet",           # Has head armor
    "has_defuser",          # Has defuse kit
]

# ============================================================================
# WEAPON PROPERTIES
# ============================================================================
WEAPON_PROPS: Final[list[str]] = [
    "active_weapon_name",           # Current weapon name
    "active_weapon_ammo",           # Ammo in current magazine
    "active_weapon_reserve_ammo",   # Reserve ammo
    "active_weapon_original_owner", # Original owner's steamid
    "active_weapon_silencer_on",    # Silencer attached
    "active_weapon_zoom_level",     # Scope zoom level (0-2)
    "active_weapon_max_ammo",       # Max magazine capacity
    "active_weapon_skin",           # Weapon skin ID
    "active_weapon_skin_name",      # Weapon skin name
    "active_weapon_paint_seed",     # Paint seed (pattern)
    "active_weapon_paint_wear",     # Weapon wear (float value)
    "active_weapon_stattrak_kills", # StatTrak kill count
    "active_weapon_quality",        # Item quality/rarity
]

# ============================================================================
# ECONOMY PROPERTIES
# ============================================================================
ECONOMY_PROPS: Final[list[str]] = [
    "balance",              # Current money
    "current_equip_value",  # Value of current equipment
    "total_cash_spent",     # Total cash spent this match
    "round_start_equip_value",  # Equipment value at round start
    "cash_spent_this_round",    # Cash spent this round
]

# ============================================================================
# COMBAT STATISTICS
# ============================================================================
COMBAT_PROPS: Final[list[str]] = [
    "kills_total",          # Total kills this match
    "deaths_total",         # Total deaths this match
    "assists_total",        # Total assists this match
    "headshot_kills_total", # Total headshot kills
    "ace_rounds_total",     # Total aces
    "4k_rounds_total",      # Total 4-kills rounds
    "3k_rounds_total",      # Total 3-kills rounds
    "damage_total",         # Total damage dealt
    "objective_total",      # Objectives completed
    "utility_damage_total", # Total utility damage
    "enemies_flashed_total",# Total enemies flashed
    "mvps",                 # MVP stars
    "score",                # Match score
]

# ============================================================================
# ROUND STATISTICS
# ============================================================================
ROUND_STATS_PROPS: Final[list[str]] = [
    "kills_this_round",     # Kills in current round
    "deaths_this_round",    # Deaths in current round
    "assists_this_round",   # Assists in current round
    "damage_this_round",    # Damage in current round
]

# ============================================================================
# UTILITY PROPERTIES
# ============================================================================
UTILITY_PROPS: Final[list[str]] = [
    "flash_duration",       # Current flash duration remaining
    "flash_alpha",          # Flash blindness intensity (0-255)
    "has_c4",               # Carrying bomb
    "spotted",              # Is spotted by enemy
    "spotted_by_mask",      # Bitmask of who spots player
]

# ============================================================================
# TEAM PROPERTIES
# ============================================================================
TEAM_PROPS: Final[list[str]] = [
    "team_num",             # Team number (2=T, 3=CT)
    "team_name",            # Team name
    "team_clan_name",       # Team clan name
    "team_rounds_won",      # Team's rounds won
]

# ============================================================================
# GAME STATE PROPERTIES
# ============================================================================
GAME_STATE_PROPS: Final[list[str]] = [
    "game_time",            # Current game time
    "round_number",         # Current round
    "round_time",           # Time in current round
    "is_warmup",            # Warmup period
    "is_freeze_time",       # Freeze time
    "is_match_started",     # Match has started
    "is_terrorist_timeout", # T timeout active
    "is_ct_timeout",        # CT timeout active
    "is_technical_timeout", # Technical timeout
    "bomb_planted",         # Bomb is planted
    "bomb_site",            # Bomb site (A/B)
]

# ============================================================================
# PLAYER FLAGS & STATES
# ============================================================================
FLAG_PROPS: Final[list[str]] = [
    "is_connected",         # Player is connected
    "is_controlling_bot",   # Controlling a bot
    "is_bot",               # Is a bot
    "is_hltv",              # Is HLTV spectator
    "is_coach",             # Is coaching
    "pending_team_num",     # Pending team change
    "player_color",         # Player color assignment
    "ever_played_on_team",  # Has played on a team
    "spawn_time",           # Time of spawn
    "comp_team_num",        # Competitive team number
]

# ============================================================================
# INVENTORY PROPERTIES
# ============================================================================
INVENTORY_PROPS: Final[list[str]] = [
    "inventory",            # Full inventory list
    "has_primary",          # Has primary weapon
    "has_secondary",        # Has secondary weapon
    "has_knife",            # Has knife
    "has_zeus",             # Has Zeus
    "has_smoke",            # Has smoke grenade
    "has_flash",            # Has flashbang
    "has_he",               # Has HE grenade
    "has_molotov",          # Has molotov/incendiary
    "has_decoy",            # Has decoy
    "smoke_count",          # Number of smokes
    "flash_count",          # Number of flashbangs
    "he_count",             # Number of HE grenades
    "molotov_count",        # Number of molotovs
    "decoy_count",          # Number of decoys
]

# ============================================================================
# ENTITY PROPERTIES (low-level)
# ============================================================================
ENTITY_PROPS: Final[list[str]] = [
    "entity_id",            # Entity ID
    "player_pawn",          # Player pawn entity
    "player_pawn_handle",   # Pawn handle
    "controller_handle",    # Controller handle
    "tick",                 # Current tick
]

# ============================================================================
# ALL PROPERTIES COMBINED
# ============================================================================
ALL_PLAYER_PROPS: Final[list[str]] = (
    IDENTITY_PROPS
    + POSITION_PROPS
    + MOVEMENT_PROPS
    + HEALTH_PROPS
    + ARMOR_PROPS
    + WEAPON_PROPS
    + ECONOMY_PROPS
    + COMBAT_PROPS
    + ROUND_STATS_PROPS
    + UTILITY_PROPS
    + TEAM_PROPS
    + FLAG_PROPS
    + INVENTORY_PROPS
    + ENTITY_PROPS
)

# Properties that should be extracted at every tick (high-frequency)
# Includes team_num for 2D replay visualization (player coloring)
HIGH_FREQUENCY_PROPS: Final[list[str]] = [
    "steamid",
    "name",
    "team_num",
    "X",
    "Y",
    "Z",
    "pitch",
    "yaw",
    "velocity_X",
    "velocity_Y",
    "velocity_Z",
    "health",
    "armor_value",
    "is_alive",
    "active_weapon_name",
    "active_weapon_ammo",
    "is_scoped",
    "is_walking",
    "ducking",
    "is_defusing",
    "is_planting",
    "has_defuser",
    "has_c4",
    "flash_duration",
    "flash_alpha",
    "balance",
    "tick",
    # Inventory for 2D replay full loadout display
    "inventory",
]

# Properties that change less frequently (can be sampled less often)
LOW_FREQUENCY_PROPS: Final[list[str]] = [
    "steamid",
    "name",
    "team_num",
    "balance",
    "kills_total",
    "deaths_total",
    "assists_total",
    "mvps",
    "score",
    "has_helmet",
    "has_defuser",
    "has_c4",
    "current_equip_value",
    "inventory",
    "crosshair_code",
    "clan_name",
]

# Property descriptions for documentation
PROPERTY_DESCRIPTIONS: Final[dict[str, str]] = {
    "steamid": "Player's unique 64-bit Steam identifier",
    "name": "Player's current display name",
    "X": "X coordinate on map (horizontal position)",
    "Y": "Y coordinate on map (horizontal position)",
    "Z": "Z coordinate on map (vertical height)",
    "pitch": "Vertical aiming angle (-90 to 90 degrees)",
    "yaw": "Horizontal aiming angle (0 to 360 degrees)",
    "velocity_X": "Velocity component on X axis (units/sec)",
    "velocity_Y": "Velocity component on Y axis (units/sec)",
    "velocity_Z": "Velocity component on Z axis (units/sec)",
    "health": "Current health points (0-100)",
    "armor_value": "Current armor points (0-100)",
    "has_helmet": "Whether player has head armor",
    "has_defuser": "Whether player has defuse kit (CT only)",
    "is_alive": "Whether player is currently alive",
    "active_weapon_name": "Name of currently held weapon",
    "balance": "Current money balance",
    "kills_total": "Total kills in the match",
    "deaths_total": "Total deaths in the match",
    "assists_total": "Total assists in the match",
    "team_num": "Team identifier (2=Terrorist, 3=Counter-Terrorist)",
    "tick": "Current game tick (64 per second)",
    "flash_alpha": "Flash blindness intensity (0=none, 255=full)",
    "is_scoped": "Whether player is scoped in",
    "is_walking": "Whether player is walking (shift)",
    "ducking": "Whether player is crouching",
    "last_place_name": "Current map location callout name",
}


def get_props_by_category(category: PropertyCategory) -> list[str]:
    """Get all properties for a given category."""
    category_map = {
        PropertyCategory.IDENTITY: IDENTITY_PROPS,
        PropertyCategory.POSITION: POSITION_PROPS,
        PropertyCategory.MOVEMENT: MOVEMENT_PROPS,
        PropertyCategory.HEALTH: HEALTH_PROPS,
        PropertyCategory.ARMOR: ARMOR_PROPS,
        PropertyCategory.WEAPONS: WEAPON_PROPS,
        PropertyCategory.ECONOMY: ECONOMY_PROPS,
        PropertyCategory.COMBAT: COMBAT_PROPS,
        PropertyCategory.UTILITY: UTILITY_PROPS,
        PropertyCategory.TEAM: TEAM_PROPS,
        PropertyCategory.FLAGS: FLAG_PROPS,
        PropertyCategory.INVENTORY: INVENTORY_PROPS,
        PropertyCategory.ENTITY: ENTITY_PROPS,
    }
    return category_map.get(category, [])
