"""
Core demo parser using demoparser2.

This is the main parser class that orchestrates extraction of all data
from CS2 demo files using demoparser2.
"""

import hashlib
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Generator

import numpy as np
import structlog
from demoparser2 import DemoParser as DP2

from src.config import Settings, get_settings
from src.models.events import ALL_EVENTS
from src.models.output import (
    DemoMetadata,
    GameMode,
    ParsedDemo,
    ParseProgress,
    ParseResult,
    PlayerInfo,
    RoundInfo,
    StreamingChunk,
    TickData,
)
from src.models.properties import ALL_PLAYER_PROPS, HIGH_FREQUENCY_PROPS

logger = structlog.get_logger()


class DemoParser:
    """
    Exhaustive CS2 demo parser.

    Extracts ALL available data from demo files using demoparser2:
    - All 60+ player properties tick-by-tick
    - All 40+ game events
    - Complete metadata
    - Grenade trajectories
    - Chat messages
    """

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize parser with settings."""
        self.settings = settings or get_settings()
        self.logger = logger.bind(service="demo_parser")

    def parse(
        self,
        demo_path: str,
        *,
        extract_ticks: bool = True,
        tick_interval: int = 1,
        extract_grenades: bool = True,
        extract_chat: bool = True,
        properties: list[str] | None = None,
        events: list[str] | None = None,
    ) -> ParsedDemo:
        """
        Parse a demo file and extract all data.

        Args:
            demo_path: Path to the demo file
            extract_ticks: Whether to extract tick-by-tick data
            tick_interval: Extract every N ticks (1 = all ticks)
            extract_grenades: Whether to extract grenade trajectories
            extract_chat: Whether to extract chat messages
            properties: Custom list of properties to extract (None = all)
            events: Custom list of events to extract (None = essential)

        Returns:
            ParsedDemo object containing all extracted data
        """
        start_time = time.time()
        self.logger.info("Starting demo parse", demo_path=demo_path)

        # Validate file exists
        path = Path(demo_path)
        if not path.exists():
            raise FileNotFoundError(f"Demo file not found: {demo_path}")

        # Initialize demoparser2
        parser = DP2(demo_path)

        # Extract all data
        metadata = self._extract_metadata(parser, path)
        players = self._extract_players(parser)
        rounds = self._extract_rounds(parser)
        event_list = self._extract_events(parser, events)

        ticks = None
        if extract_ticks:
            ticks = self._extract_ticks(parser, tick_interval, properties)

        grenades = []
        if extract_grenades:
            grenades = self._extract_grenades(parser)

        chat = []
        if extract_chat:
            chat = self._extract_chat(parser)

        parse_time = time.time() - start_time
        self.logger.info(
            "Demo parse complete",
            demo_path=demo_path,
            parse_time=f"{parse_time:.2f}s",
            events_count=len(event_list),
            ticks_count=len(ticks) if ticks else 0,
        )

        return ParsedDemo(
            metadata=metadata,
            players=players,
            rounds=rounds,
            events=event_list,
            ticks=ticks,
            grenades=grenades,
            chat_messages=chat,
        )

    def parse_streaming(
        self,
        demo_path: str,
        *,
        chunk_size: int = 10000,
        properties: list[str] | None = None,
        events: list[str] | None = None,
    ) -> Generator[StreamingChunk, None, None]:
        """
        Parse a demo file with streaming output.

        Yields chunks of data for processing without loading everything into memory.

        Args:
            demo_path: Path to the demo file
            chunk_size: Number of ticks per chunk
            properties: Custom list of properties (None = high frequency)
            events: Custom list of events (None = essential)

        Yields:
            StreamingChunk objects containing partial data
        """
        self.logger.info("Starting streaming parse", demo_path=demo_path)

        path = Path(demo_path)
        if not path.exists():
            raise FileNotFoundError(f"Demo file not found: {demo_path}")

        parser = DP2(demo_path)

        # First yield metadata
        metadata = self._extract_metadata(parser, path)
        yield StreamingChunk(
            chunk_type="metadata",
            chunk_index=0,
            data=metadata.model_dump(),
        )

        # Yield players
        players = self._extract_players(parser)
        yield StreamingChunk(
            chunk_type="players",
            chunk_index=0,
            data={"players": [p.model_dump() for p in players]},
        )

        # Yield rounds
        rounds = self._extract_rounds(parser)
        yield StreamingChunk(
            chunk_type="rounds",
            chunk_index=0,
            data={"rounds": [r.model_dump() for r in rounds]},
        )

        # Yield events
        event_list = self._extract_events(parser, events)
        yield StreamingChunk(
            chunk_type="events",
            chunk_index=0,
            data={"events": event_list},
        )

        # Yield ticks in chunks
        props = properties or HIGH_FREQUENCY_PROPS
        all_ticks = self._extract_ticks_raw(parser, props)

        total_ticks = len(all_ticks)
        num_chunks = (total_ticks + chunk_size - 1) // chunk_size

        for i in range(num_chunks):
            start_idx = i * chunk_size
            end_idx = min((i + 1) * chunk_size, total_ticks)
            chunk_ticks = all_ticks[start_idx:end_idx]

            yield StreamingChunk(
                chunk_type="ticks",
                chunk_index=i,
                total_chunks=num_chunks,
                data={"ticks": chunk_ticks},
            )

        # Yield grenades
        grenades = self._extract_grenades(parser)
        yield StreamingChunk(
            chunk_type="grenades",
            chunk_index=0,
            data={"grenades": grenades},
        )

        self.logger.info("Streaming parse complete", demo_path=demo_path)

    def _extract_metadata(self, parser: DP2, path: Path) -> DemoMetadata:
        """Extract complete demo metadata."""
        # Get header info
        header = parser.parse_header()

        # Calculate file hash
        file_hash = self._calculate_file_hash(path)

        # Get tick count from parsing minimal data
        try:
            ticks_df = parser.parse_ticks(["tick"])
            total_ticks = int(ticks_df["tick"].max()) if len(ticks_df) > 0 else 0
        except Exception:
            total_ticks = 0

        # Determine game mode from map name or other indicators
        map_name = header.get("map_name", "unknown")
        game_mode = self._detect_game_mode(map_name, header)

        # Extract team info
        team1_name, team2_name = self._extract_team_names(parser)

        return DemoMetadata(
            demo_file_name=path.name,
            demo_file_size=path.stat().st_size,
            demo_file_hash=file_hash,
            parser_version="demoparser2",
            map_name=map_name,
            game_mode=game_mode,
            match_id=header.get("match_id"),
            server_name=header.get("server_name"),
            tick_rate=self.settings.tick_rate,
            total_ticks=total_ticks,
            duration_seconds=total_ticks / self.settings.tick_rate,
            demo_version=header.get("demo_version"),
            network_protocol=header.get("network_protocol"),
            build_number=header.get("build_number"),
            team1_name=team1_name,
            team2_name=team2_name,
        )

    def _extract_players(self, parser: DP2) -> list[PlayerInfo]:
        """Extract complete player information."""
        players = []

        # Get player stats
        try:
            player_props = [
                "steamid",
                "name",
                "team_num",
                "kills_total",
                "deaths_total",
                "assists_total",
                "headshot_kills_total",
                "mvps",
                "score",
                "damage_total",
                "total_cash_spent",
                "clan_name",
            ]

            # Get data at end of match for final stats
            df = parser.parse_ticks(player_props)

            if len(df) > 0:
                # Get unique players by steamid
                last_tick_data = df.groupby("steamid").last().reset_index()

                for _, row in last_tick_data.iterrows():
                    if row.get("steamid") and row["steamid"] != "0":
                        players.append(
                            PlayerInfo(
                                steamid=str(row["steamid"]),
                                name=str(row.get("name", "Unknown")),
                                team_num=int(row.get("team_num", 0)),
                                clan_name=row.get("clan_name"),
                                kills=int(row.get("kills_total", 0)),
                                deaths=int(row.get("deaths_total", 0)),
                                assists=int(row.get("assists_total", 0)),
                                headshot_kills=int(row.get("headshot_kills_total", 0)),
                                mvps=int(row.get("mvps", 0)),
                                score=int(row.get("score", 0)),
                                damage_dealt=int(row.get("damage_total", 0)),
                                total_cash_spent=int(row.get("total_cash_spent", 0)),
                            )
                        )
        except Exception as e:
            self.logger.warning("Failed to extract player stats", error=str(e))

        return players

    def _extract_rounds(self, parser: DP2) -> list[RoundInfo]:
        """Extract complete round information."""
        rounds = []

        try:
            # Get round events - some may return empty lists instead of DataFrames
            round_starts = self._safe_parse_event(parser, "round_start")
            round_ends = self._safe_parse_event(parser, "round_end")
            freeze_ends = self._safe_parse_event(parser, "round_freeze_end")
            bomb_plants = self._safe_parse_event(parser, "bomb_planted")
            bomb_defuses = self._safe_parse_event(parser, "bomb_defused")
            bomb_explosions = self._safe_parse_event(parser, "bomb_exploded")

            if round_starts is None or len(round_starts) == 0:
                self.logger.warning("No round_start events found")
                return rounds

            if round_ends is None or len(round_ends) == 0:
                self.logger.warning("No round_end events found")
                return rounds

            # Track scores manually since round_end doesn't include them
            ct_score = 0
            t_score = 0

            # Build round info
            for i, (_, start_row) in enumerate(round_starts.iterrows()):
                round_num = int(start_row.get("round", i + 1))
                start_tick = int(start_row["tick"])

                # Find corresponding end
                matching_ends = round_ends[round_ends["tick"] > start_tick]
                if len(matching_ends) == 0:
                    continue

                end_row = matching_ends.iloc[0]
                end_tick = int(end_row["tick"])

                # Get winner - demoparser2 returns "CT" or "T" as string
                winner_str = str(end_row.get("winner", ""))
                winner_team = 3 if winner_str == "CT" else (2 if winner_str == "T" else 0)

                # Update scores based on winner
                if winner_team == 3:
                    ct_score += 1
                elif winner_team == 2:
                    t_score += 1

                # Get win reason
                win_reason = str(end_row.get("reason", ""))

                # Find freeze end
                freeze_tick = None
                if freeze_ends is not None and len(freeze_ends) > 0:
                    matching_freeze = freeze_ends[
                        (freeze_ends["tick"] > start_tick) & (freeze_ends["tick"] < end_tick)
                    ]
                    if len(matching_freeze) > 0:
                        freeze_tick = int(matching_freeze.iloc[0]["tick"])

                # Check for bomb events in this round
                bomb_planted = False
                bomb_plant_tick = None
                bomb_site = None
                bomb_defused = False
                bomb_exploded = False

                if bomb_plants is not None and len(bomb_plants) > 0:
                    round_plants = bomb_plants[
                        (bomb_plants["tick"] > start_tick) & (bomb_plants["tick"] <= end_tick)
                    ]
                    if len(round_plants) > 0:
                        bomb_planted = True
                        bomb_plant_tick = int(round_plants.iloc[0]["tick"])
                        # Site is numeric: 111=A, 112=B (can be numpy int types)
                        site_val = round_plants.iloc[0]["site"]
                        if isinstance(site_val, (int, float, np.integer, np.floating)):
                            bomb_site = "A" if int(site_val) == 111 else "B"
                        else:
                            bomb_site = str(site_val)

                if bomb_defuses is not None and len(bomb_defuses) > 0:
                    round_defuses = bomb_defuses[
                        (bomb_defuses["tick"] > start_tick) & (bomb_defuses["tick"] <= end_tick)
                    ]
                    if len(round_defuses) > 0:
                        bomb_defused = True

                if bomb_explosions is not None and len(bomb_explosions) > 0:
                    round_explosions = bomb_explosions[
                        (bomb_explosions["tick"] > start_tick) & (bomb_explosions["tick"] <= end_tick)
                    ]
                    if len(round_explosions) > 0:
                        bomb_exploded = True

                # Determine round type (pistol, eco, etc.)
                is_pistol = round_num in [1, 13]  # First round of each half

                rounds.append(
                    RoundInfo(
                        round_number=round_num,
                        start_tick=start_tick,
                        end_tick=end_tick,
                        freeze_end_tick=freeze_tick,
                        winner_team=winner_team,
                        win_reason=win_reason,
                        end_reason_code=0,  # Not available in demoparser2
                        ct_score=ct_score,
                        t_score=t_score,
                        is_pistol_round=is_pistol,
                        bomb_planted=bomb_planted,
                        bomb_plant_tick=bomb_plant_tick,
                        bomb_site=bomb_site,
                        bomb_defused=bomb_defused,
                        bomb_exploded=bomb_exploded,
                        mvp_steamid=None,  # MVP events not reliably available
                        mvp_reason=None,
                    )
                )

        except Exception as e:
            self.logger.warning("Failed to extract round info", error=str(e))

        return rounds

    def _safe_parse_event(
        self,
        parser: DP2,
        event_name: str,
        player_props: list[str] | None = None,
        other_props: list[str] | None = None,
    ):
        """Safely parse an event, returning None if it fails or returns a list.

        Args:
            parser: DemoParser instance
            event_name: Name of the event to parse
            player_props: Optional list of player properties for main player (e.g., ["X", "Y", "Z"])
            other_props: Optional list of properties for other player (e.g., attacker in deaths)
        """
        try:
            kwargs = {}
            if player_props:
                kwargs["player"] = player_props
            if other_props:
                kwargs["other"] = other_props

            if kwargs:
                result = parser.parse_event(event_name, **kwargs)
            else:
                result = parser.parse_event(event_name)
            # demoparser2 sometimes returns empty lists instead of DataFrames
            if isinstance(result, list):
                return None
            return result
        except Exception:
            return None

    # Events that need player position (X, Y, Z) for visualization
    EVENTS_NEEDING_POSITION = {
        "bomb_planted",
        "bomb_defused",
        "bomb_exploded",
    }

    # Events that need both victim AND attacker positions
    EVENTS_NEEDING_BOTH_POSITIONS = {
        "player_death",  # Need attacker and victim positions for kill lines
    }

    def _extract_events(
        self, parser: DP2, event_list: list[str] | None = None
    ) -> list[dict[str, Any]]:
        """Extract all game events with position data for visualization."""
        events = []
        target_events = event_list or ALL_EVENTS

        for event_name in target_events:
            try:
                # Add position props for events that need them for 2D replay
                player_props = None
                other_props = None

                if event_name in self.EVENTS_NEEDING_POSITION:
                    # Only victim/user position needed
                    player_props = ["X", "Y", "Z"]
                elif event_name in self.EVENTS_NEEDING_BOTH_POSITIONS:
                    # Both victim and attacker positions needed
                    player_props = ["X", "Y", "Z"]  # user (victim)
                    other_props = ["X", "Y", "Z"]   # attacker

                event_df = self._safe_parse_event(parser, event_name, player_props, other_props)
                if event_df is not None and len(event_df) > 0:
                    for _, row in event_df.iterrows():
                        event_data = row.to_dict()
                        event_data["event_name"] = event_name
                        events.append(event_data)
            except Exception as e:
                self.logger.debug(
                    "Event not found or failed to parse",
                    event=event_name,
                    error=str(e),
                )

        # Sort events by tick
        events.sort(key=lambda x: x.get("tick", 0))

        return events

    def _extract_ticks(
        self,
        parser: DP2,
        tick_interval: int = 1,
        properties: list[str] | None = None,
    ) -> list[TickData]:
        """Extract tick-by-tick player state data."""
        ticks = []
        props = properties or HIGH_FREQUENCY_PROPS

        try:
            df = parser.parse_ticks(props)

            if len(df) > 0:
                # Get unique ticks
                unique_ticks = sorted(df["tick"].unique())

                # Sample at interval
                sampled_ticks = unique_ticks[::tick_interval]

                for tick in sampled_ticks:
                    tick_data = df[df["tick"] == tick]
                    players_data = []

                    for _, row in tick_data.iterrows():
                        player_state = row.to_dict()
                        # Convert steamid to string for consistency
                        if "steamid" in player_state:
                            player_state["steamid"] = str(player_state["steamid"])
                        players_data.append(player_state)

                    ticks.append(
                        TickData(
                            tick=int(tick),
                            game_time=float(tick) / self.settings.tick_rate,
                            players=players_data,
                        )
                    )

        except Exception as e:
            self.logger.warning("Failed to extract tick data", error=str(e))

        return ticks

    def _extract_ticks_raw(
        self, parser: DP2, properties: list[str]
    ) -> list[dict[str, Any]]:
        """Extract raw tick data as list of dicts."""
        try:
            df = parser.parse_ticks(properties)
            return df.to_dict(orient="records")
        except Exception as e:
            self.logger.warning("Failed to extract raw tick data", error=str(e))
            return []

    def _extract_grenades(self, parser: DP2) -> list[dict[str, Any]]:
        """Extract grenade trajectories using the full GrenadeExtractor.

        This includes:
        - Throw events (weapon_fire) with position and angles
        - Detonate events with entity_id for trajectory linking
        - Expired events for smoke/molotov end times
        - Flash blind data with entity-based linking
        """
        from src.extractors.grenades import GrenadeExtractor

        try:
            extractor = GrenadeExtractor(parser)
            return extractor.extract_all_grenades()
        except Exception as e:
            self.logger.warning("Failed to extract grenades with full extractor", error=str(e))
            # Fallback to basic extraction
            grenades = []
            grenade_events = [
                "smokegrenade_detonate",
                "flashbang_detonate",
                "hegrenade_detonate",
                "molotov_detonate",
                "decoy_started",
            ]

            for event_name in grenade_events:
                try:
                    event_df = parser.parse_event(event_name)
                    if len(event_df) > 0:
                        for _, row in event_df.iterrows():
                            grenade_data = {
                                "type": event_name.replace("_detonate", "").replace("_started", ""),
                                "event": "detonate" if "detonate" in event_name else "start",
                                "tick": int(row.get("tick", 0)),
                                "X": float(row.get("x", 0)),
                                "Y": float(row.get("y", 0)),
                                "Z": float(row.get("z", 0)),
                                "thrower_steamid": str(row.get("user_steamid", "")),
                                "thrower_name": str(row.get("user_name", "")),
                                "entity_id": int(row.get("entityid", 0)),
                            }
                            grenades.append(grenade_data)
                except Exception:
                    pass

            return grenades

    def _extract_chat(self, parser: DP2) -> list[dict[str, Any]]:
        """Extract chat messages."""
        chat = []

        try:
            chat_df = parser.parse_event("player_chat")
            if len(chat_df) > 0:
                for _, row in chat_df.iterrows():
                    chat.append(
                        {
                            "tick": int(row.get("tick", 0)),
                            "steamid": str(row.get("steamid", "")),
                            "name": str(row.get("name", "")),
                            "message": str(row.get("text", "")),
                            "is_all_chat": bool(row.get("teamonly", True) is False),
                        }
                    )
        except Exception:
            pass

        return chat

    def _calculate_file_hash(self, path: Path) -> str:
        """Calculate SHA-256 hash of demo file."""
        sha256_hash = hashlib.sha256()
        with open(path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _detect_game_mode(
        self, map_name: str, header: dict[str, Any]
    ) -> GameMode:
        """Detect game mode from map name and header info."""
        map_lower = map_name.lower()

        # Check for wingman maps
        if "wingman" in map_lower or map_lower.startswith("ar_"):
            return GameMode.WINGMAN

        # Check for deathmatch
        if "dm_" in map_lower:
            return GameMode.DEATHMATCH

        # Check for casual
        if header.get("game_type") == "casual":
            return GameMode.CASUAL

        # Default to competitive for de_ maps
        if map_lower.startswith("de_"):
            return GameMode.COMPETITIVE

        return GameMode.UNKNOWN

    def _extract_team_names(self, parser: DP2) -> tuple[str, str]:
        """Extract team names from player data."""
        try:
            df = parser.parse_ticks(["team_clan_name", "team_num"])
            if len(df) > 0:
                team2_names = df[df["team_num"] == 2]["team_clan_name"].unique()
                team3_names = df[df["team_num"] == 3]["team_clan_name"].unique()

                team1 = team2_names[0] if len(team2_names) > 0 else "Terrorists"
                team2 = team3_names[0] if len(team3_names) > 0 else "Counter-Terrorists"

                return str(team1), str(team2)
        except Exception:
            pass

        return "Team 1", "Team 2"
