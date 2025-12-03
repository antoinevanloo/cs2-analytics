"""
Metadata extractor module.

Handles extraction of demo file and match metadata.
"""

import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog
from demoparser2 import DemoParser as DP2

from src.models.output import DemoMetadata, GameMode, PlayerInfo

logger = structlog.get_logger()


class MetadataExtractor:
    """
    Extracts comprehensive metadata from CS2 demos.

    Includes file info, match info, player summaries, and server details.
    """

    def __init__(self, parser: DP2, demo_path: str, tick_rate: int = 64) -> None:
        """Initialize with a demoparser2 instance and file path."""
        self.parser = parser
        self.demo_path = Path(demo_path)
        self.tick_rate = tick_rate
        self.logger = logger.bind(extractor="metadata")

    def extract(self) -> DemoMetadata:
        """Extract all available metadata."""
        header = self._get_header()
        file_info = self._get_file_info()
        timing_info = self._get_timing_info()
        team_info = self._get_team_info()
        score_info = self._get_score_info()
        player_summary = self._get_player_summary()

        return DemoMetadata(
            demo_file_name=file_info["name"],
            demo_file_size=file_info["size"],
            demo_file_hash=file_info["hash"],
            parser_version="demoparser2",
            map_name=header.get("map_name", "unknown"),
            game_mode=self._detect_game_mode(header),
            match_id=header.get("match_id"),
            server_name=header.get("server_name"),
            tick_rate=self.tick_rate,
            total_ticks=timing_info["total_ticks"],
            duration_seconds=timing_info["duration"],
            match_date=timing_info.get("match_date"),
            demo_version=header.get("demo_version"),
            network_protocol=header.get("network_protocol"),
            build_number=header.get("build_number"),
            team1_name=team_info["team1"],
            team2_name=team_info["team2"],
            team1_score=score_info["team1_score"],
            team2_score=score_info["team2_score"],
            team1_first_half_score=score_info.get("team1_first_half", 0),
            team2_first_half_score=score_info.get("team2_first_half", 0),
            player_count=len(player_summary),
            players=player_summary,
        )

    def _get_header(self) -> dict[str, Any]:
        """Extract header information."""
        try:
            return self.parser.parse_header()
        except Exception as e:
            self.logger.warning("Failed to parse header", error=str(e))
            return {}

    def _get_file_info(self) -> dict[str, Any]:
        """Get file-level information."""
        return {
            "name": self.demo_path.name,
            "size": self.demo_path.stat().st_size,
            "hash": self._calculate_hash(),
        }

    def _calculate_hash(self) -> str:
        """Calculate SHA-256 hash of the demo file."""
        sha256_hash = hashlib.sha256()
        try:
            with open(self.demo_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception as e:
            self.logger.warning("Failed to calculate file hash", error=str(e))
            return ""

    def _get_timing_info(self) -> dict[str, Any]:
        """Get timing-related information."""
        try:
            df = self.parser.parse_ticks(["tick"])
            if len(df) > 0:
                max_tick = int(df["tick"].max())
                return {
                    "total_ticks": max_tick,
                    "duration": max_tick / self.tick_rate,
                }
        except Exception as e:
            self.logger.warning("Failed to get timing info", error=str(e))

        return {"total_ticks": 0, "duration": 0.0}

    def _get_team_info(self) -> dict[str, str]:
        """Extract team names."""
        team1 = "Terrorists"
        team2 = "Counter-Terrorists"

        try:
            df = self.parser.parse_ticks(["team_clan_name", "team_num"])
            if len(df) > 0:
                team2_names = df[df["team_num"] == 2]["team_clan_name"].dropna().unique()
                team3_names = df[df["team_num"] == 3]["team_clan_name"].dropna().unique()

                if len(team2_names) > 0 and team2_names[0]:
                    team1 = str(team2_names[0])
                if len(team3_names) > 0 and team3_names[0]:
                    team2 = str(team3_names[0])
        except Exception as e:
            self.logger.warning("Failed to get team names", error=str(e))

        return {"team1": team1, "team2": team2}

    def _get_score_info(self) -> dict[str, int]:
        """Extract final and half-time scores."""
        scores = {
            "team1_score": 0,
            "team2_score": 0,
            "team1_first_half": 0,
            "team2_first_half": 0,
        }

        try:
            round_ends = self.parser.parse_event("round_end")
            if len(round_ends) > 0:
                # Get final scores from last round
                last_round = round_ends.iloc[-1]
                scores["team1_score"] = int(last_round.get("t_score", 0))
                scores["team2_score"] = int(last_round.get("ct_score", 0))

                # Get halftime scores (after round 12)
                half_time_rounds = round_ends[round_ends["tick"] <= round_ends["tick"].quantile(0.5)]
                if len(half_time_rounds) > 0:
                    half_round = half_time_rounds.iloc[-1]
                    scores["team1_first_half"] = int(half_round.get("t_score", 0))
                    scores["team2_first_half"] = int(half_round.get("ct_score", 0))

        except Exception as e:
            self.logger.warning("Failed to get scores", error=str(e))

        return scores

    def _get_player_summary(self) -> list[dict[str, Any]]:
        """Get summary of all players."""
        players = []

        try:
            props = [
                "steamid",
                "name",
                "team_num",
                "kills_total",
                "deaths_total",
                "assists_total",
                "mvps",
                "score",
            ]

            df = self.parser.parse_ticks(props)
            if len(df) > 0:
                # Get final state for each player
                final_states = df.groupby("steamid").last().reset_index()

                for _, row in final_states.iterrows():
                    steamid = str(row.get("steamid", ""))
                    if steamid and steamid != "0":
                        players.append({
                            "steamid": steamid,
                            "name": str(row.get("name", "Unknown")),
                            "team": int(row.get("team_num", 0)),
                            "kills": int(row.get("kills_total", 0)),
                            "deaths": int(row.get("deaths_total", 0)),
                            "assists": int(row.get("assists_total", 0)),
                            "mvps": int(row.get("mvps", 0)),
                            "score": int(row.get("score", 0)),
                        })

        except Exception as e:
            self.logger.warning("Failed to get player summary", error=str(e))

        return players

    def _detect_game_mode(self, header: dict[str, Any]) -> GameMode:
        """Detect game mode from available information."""
        map_name = header.get("map_name", "").lower()

        # Wingman indicators
        if "wingman" in map_name or "_wingman" in map_name:
            return GameMode.WINGMAN

        # Deathmatch indicators
        if map_name.startswith("dm_"):
            return GameMode.DEATHMATCH

        # Arms race
        if map_name.startswith("ar_"):
            return GameMode.CUSTOM

        # Check game type from header
        game_type = header.get("game_type", "")
        if game_type:
            game_type_lower = game_type.lower()
            if "casual" in game_type_lower:
                return GameMode.CASUAL
            if "competitive" in game_type_lower:
                return GameMode.COMPETITIVE
            if "premier" in game_type_lower:
                return GameMode.PREMIER

        # Default to competitive for standard defuse maps
        if map_name.startswith("de_"):
            return GameMode.COMPETITIVE

        return GameMode.UNKNOWN

    def get_map_bounds(self) -> dict[str, float] | None:
        """
        Get the coordinate bounds of player positions.

        Useful for normalizing positions for heatmap generation.
        """
        try:
            df = self.parser.parse_ticks(["X", "Y", "Z", "is_alive"])
            alive_data = df[df["is_alive"] == True]  # noqa: E712

            if len(alive_data) > 0:
                return {
                    "min_x": float(alive_data["X"].min()),
                    "max_x": float(alive_data["X"].max()),
                    "min_y": float(alive_data["Y"].min()),
                    "max_y": float(alive_data["Y"].max()),
                    "min_z": float(alive_data["Z"].min()),
                    "max_z": float(alive_data["Z"].max()),
                }
        except Exception as e:
            self.logger.warning("Failed to get map bounds", error=str(e))

        return None
