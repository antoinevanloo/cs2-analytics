"""
Output models for parsed demo data.

Defines the structure of the complete parsed demo output,
optimized for streaming and downstream processing.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class GameMode(str, Enum):
    """CS2 game modes."""

    COMPETITIVE = "competitive"
    PREMIER = "premier"
    WINGMAN = "wingman"
    CASUAL = "casual"
    DEATHMATCH = "deathmatch"
    CUSTOM = "custom"
    UNKNOWN = "unknown"


class MapName(str, Enum):
    """Official CS2 competitive maps."""

    ANCIENT = "de_ancient"
    ANUBIS = "de_anubis"
    DUST2 = "de_dust2"
    INFERNO = "de_inferno"
    MIRAGE = "de_mirage"
    NUKE = "de_nuke"
    OVERPASS = "de_overpass"
    VERTIGO = "de_vertigo"
    TRAIN = "de_train"
    CACHE = "de_cache"
    OTHER = "other"


class DemoMetadata(BaseModel):
    """Complete demo file metadata."""

    # File info
    demo_file_name: str
    demo_file_size: int
    demo_file_hash: str | None = None
    parse_timestamp: datetime = Field(default_factory=datetime.utcnow)
    parser_version: str

    # Match info
    map_name: str
    game_mode: GameMode = GameMode.UNKNOWN
    match_id: str | None = None
    server_name: str | None = None

    # Timing
    tick_rate: int = 64
    total_ticks: int
    duration_seconds: float
    match_date: datetime | None = None

    # Scores
    team1_name: str = "Team 1"
    team2_name: str = "Team 2"
    team1_score: int = 0
    team2_score: int = 0
    team1_first_half_score: int = 0
    team2_first_half_score: int = 0

    # Network info
    demo_version: int | None = None
    network_protocol: int | None = None
    build_number: int | None = None

    # Players summary
    player_count: int = 0
    players: list[dict[str, Any]] = Field(default_factory=list)


class PlayerInfo(BaseModel):
    """Complete player information."""

    steamid: str
    name: str
    team_num: int
    team_name: str | None = None
    clan_name: str | None = None

    # Performance
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    headshot_kills: int = 0
    mvps: int = 0
    score: int = 0

    # Economy
    total_cash_spent: int = 0
    avg_equipment_value: float = 0.0

    # Advanced stats
    damage_dealt: int = 0
    utility_damage: int = 0
    enemies_flashed: int = 0
    flash_assists: int = 0

    # K/D breakdown
    first_kills: int = 0
    first_deaths: int = 0
    clutches_won: int = 0
    clutches_played: int = 0

    # Trade stats
    traded_kills: int = 0
    trade_deaths: int = 0


class RoundInfo(BaseModel):
    """Complete round information."""

    round_number: int
    start_tick: int
    end_tick: int
    freeze_end_tick: int | None = None

    # Outcome
    winner_team: int  # 2=T, 3=CT
    win_reason: str
    end_reason_code: int

    # Scores at round end
    ct_score: int
    t_score: int

    # Round type
    is_pistol_round: bool = False
    is_eco_round: bool = False
    is_force_buy: bool = False
    is_full_buy: bool = False

    # Economy
    ct_equipment_value: int = 0
    t_equipment_value: int = 0
    ct_money_spent: int = 0
    t_money_spent: int = 0

    # Combat
    kills_count: int = 0
    ct_kills: int = 0
    t_kills: int = 0

    # Bomb
    bomb_planted: bool = False
    bomb_plant_tick: int | None = None
    bomb_site: str | None = None
    bomb_defused: bool = False
    bomb_exploded: bool = False

    # MVP
    mvp_steamid: str | None = None
    mvp_reason: int | None = None


class TickData(BaseModel):
    """Tick-by-tick player state."""

    tick: int
    game_time: float
    players: list[dict[str, Any]]


class ParsedDemo(BaseModel):
    """
    Complete parsed demo output structure.

    This is the main output model containing all extracted data
    from a CS2 demo file.
    """

    # Metadata
    metadata: DemoMetadata

    # Player info
    players: list[PlayerInfo]

    # Round data
    rounds: list[RoundInfo]

    # Events (all game events)
    events: list[dict[str, Any]]

    # Tick data (player positions over time)
    ticks: list[TickData] | None = None  # Optional, can be very large

    # Grenade trajectories
    grenades: list[dict[str, Any]] = Field(default_factory=list)

    # Additional data
    chat_messages: list[dict[str, Any]] = Field(default_factory=list)


class StreamingChunk(BaseModel):
    """
    Chunk of data for streaming output.

    Allows processing demo data incrementally without
    loading everything into memory.
    """

    chunk_type: str  # "metadata", "events", "ticks", "players", "rounds", "grenades"
    chunk_index: int
    total_chunks: int | None = None
    data: dict[str, Any]


class ParseProgress(BaseModel):
    """Parsing progress update."""

    demo_id: str
    status: str  # "queued", "parsing", "extracting_events", "extracting_ticks", "complete", "error"
    progress_percent: float
    current_tick: int | None = None
    total_ticks: int | None = None
    events_extracted: int = 0
    error_message: str | None = None


class ParseRequest(BaseModel):
    """Request to parse a demo file."""

    demo_path: str | None = None  # Local path
    demo_url: str | None = None   # Remote URL (S3, etc.)
    demo_id: str | None = None    # Unique identifier for tracking

    # Options
    extract_ticks: bool = True
    tick_interval: int = 1        # Extract every N ticks
    extract_grenades: bool = True
    extract_chat: bool = True
    properties: list[str] | None = None  # Custom property list
    events: list[str] | None = None      # Custom event list

    # Output
    output_format: str = "ndjson"
    compress: bool = True
    stream: bool = False


class ParseResult(BaseModel):
    """Result of a parse operation."""

    demo_id: str
    success: bool
    output_path: str | None = None
    output_url: str | None = None
    metadata: DemoMetadata | None = None
    error: str | None = None
    parse_time_seconds: float = 0.0
