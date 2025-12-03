"""
Tick data extractor module.

Handles extraction of tick-by-tick player state data.
"""

from typing import Any

import structlog
from demoparser2 import DemoParser as DP2

from src.models.properties import (
    ALL_PLAYER_PROPS,
    HIGH_FREQUENCY_PROPS,
    LOW_FREQUENCY_PROPS,
    PropertyCategory,
    get_props_by_category,
)

logger = structlog.get_logger()


class TickExtractor:
    """
    Extracts tick-by-tick player state data from CS2 demos.

    Provides methods to extract various property sets
    at configurable intervals.
    """

    def __init__(self, parser: DP2, tick_rate: int = 64) -> None:
        """Initialize with a demoparser2 instance."""
        self.parser = parser
        self.tick_rate = tick_rate
        self.logger = logger.bind(extractor="ticks")

    def extract_all_props(
        self, interval: int = 1
    ) -> list[dict[str, Any]]:
        """
        Extract all available properties at specified interval.

        Args:
            interval: Extract every N ticks

        Returns:
            List of tick data dictionaries
        """
        return self._extract_props(ALL_PLAYER_PROPS, interval)

    def extract_high_frequency(
        self, interval: int = 1
    ) -> list[dict[str, Any]]:
        """
        Extract high-frequency properties (position, aim, health).

        Optimized for real-time visualization and heatmaps.
        """
        return self._extract_props(HIGH_FREQUENCY_PROPS, interval)

    def extract_low_frequency(
        self, interval: int = 64
    ) -> list[dict[str, Any]]:
        """
        Extract low-frequency properties (economy, stats).

        Suitable for per-second or per-round snapshots.
        """
        return self._extract_props(LOW_FREQUENCY_PROPS, interval)

    def extract_by_category(
        self, category: PropertyCategory, interval: int = 1
    ) -> list[dict[str, Any]]:
        """Extract properties from a specific category."""
        props = get_props_by_category(category)
        # Always include steamid and tick
        if "steamid" not in props:
            props = ["steamid"] + props
        if "tick" not in props:
            props = ["tick"] + props
        return self._extract_props(props, interval)

    def extract_custom(
        self, properties: list[str], interval: int = 1
    ) -> list[dict[str, Any]]:
        """Extract a custom set of properties."""
        # Ensure essential props are included
        props = list(properties)
        if "steamid" not in props:
            props = ["steamid"] + props
        if "tick" not in props:
            props = ["tick"] + props
        return self._extract_props(props, interval)

    def _extract_props(
        self, properties: list[str], interval: int
    ) -> list[dict[str, Any]]:
        """Internal method to extract properties."""
        result = []

        try:
            df = self.parser.parse_ticks(properties)

            if len(df) == 0:
                return result

            # Get unique ticks
            unique_ticks = sorted(df["tick"].unique())

            # Sample at interval
            sampled_ticks = unique_ticks[::interval]

            for tick in sampled_ticks:
                tick_data = df[df["tick"] == tick]

                for _, row in tick_data.iterrows():
                    player_state = row.to_dict()

                    # Ensure steamid is string
                    if "steamid" in player_state:
                        player_state["steamid"] = str(player_state["steamid"])

                    # Skip invalid entries
                    if player_state.get("steamid") in [None, "0", ""]:
                        continue

                    result.append(player_state)

        except Exception as e:
            self.logger.warning("Failed to extract tick data", error=str(e))

        return result

    def extract_player_positions(
        self, interval: int = 1
    ) -> list[dict[str, Any]]:
        """
        Extract just player positions over time.

        Optimized for heatmap generation and trajectory analysis.
        """
        props = ["steamid", "tick", "X", "Y", "Z", "team_num", "is_alive"]
        return self._extract_props(props, interval)

    def extract_player_aim(
        self, interval: int = 1
    ) -> list[dict[str, Any]]:
        """
        Extract player aim data (pitch, yaw).

        Useful for aim analysis and crosshair placement studies.
        """
        props = ["steamid", "tick", "pitch", "yaw", "X", "Y", "Z", "is_scoped"]
        return self._extract_props(props, interval)

    def extract_player_velocity(
        self, interval: int = 1
    ) -> list[dict[str, Any]]:
        """
        Extract player velocity data.

        Useful for movement analysis.
        """
        props = [
            "steamid",
            "tick",
            "X",
            "Y",
            "Z",
            "velocity_X",
            "velocity_Y",
            "velocity_Z",
            "is_walking",
            "ducking",
        ]
        return self._extract_props(props, interval)

    def extract_economy_timeline(self) -> list[dict[str, Any]]:
        """
        Extract economy data at round boundaries.

        Returns per-round economy snapshots.
        """
        props = [
            "steamid",
            "tick",
            "name",
            "team_num",
            "balance",
            "current_equip_value",
            "total_cash_spent",
        ]

        try:
            # Get round start events to find tick boundaries
            round_starts = self.parser.parse_event("round_start")
            round_ticks = sorted(round_starts["tick"].tolist())

            # Get data at round start ticks
            df = self.parser.parse_ticks(props)

            result = []
            for tick in round_ticks:
                # Get data closest to round start
                tick_data = df[df["tick"] == tick]
                for _, row in tick_data.iterrows():
                    player_state = row.to_dict()
                    if player_state.get("steamid") not in [None, "0", ""]:
                        player_state["steamid"] = str(player_state["steamid"])
                        result.append(player_state)

            return result

        except Exception as e:
            self.logger.warning("Failed to extract economy timeline", error=str(e))
            return []

    def extract_round_snapshots(
        self, properties: list[str] | None = None
    ) -> dict[int, list[dict[str, Any]]]:
        """
        Extract data at the start of each round.

        Returns dict mapping round number to player states.
        """
        props = properties or LOW_FREQUENCY_PROPS

        # Ensure essential props
        if "steamid" not in props:
            props = ["steamid"] + props
        if "tick" not in props:
            props = ["tick"] + props

        try:
            round_starts = self.parser.parse_event("round_start")
            df = self.parser.parse_ticks(props)

            result: dict[int, list[dict[str, Any]]] = {}

            for i, (_, round_row) in enumerate(round_starts.iterrows()):
                round_num = i + 1
                round_tick = int(round_row["tick"])

                tick_data = df[df["tick"] == round_tick]
                players = []

                for _, row in tick_data.iterrows():
                    player_state = row.to_dict()
                    if player_state.get("steamid") not in [None, "0", ""]:
                        player_state["steamid"] = str(player_state["steamid"])
                        players.append(player_state)

                result[round_num] = players

            return result

        except Exception as e:
            self.logger.warning("Failed to extract round snapshots", error=str(e))
            return {}

    def get_tick_range(self) -> tuple[int, int]:
        """Get the tick range of the demo."""
        try:
            df = self.parser.parse_ticks(["tick"])
            if len(df) > 0:
                return int(df["tick"].min()), int(df["tick"].max())
        except Exception:
            pass
        return 0, 0

    def get_total_ticks(self) -> int:
        """Get total number of ticks in the demo."""
        min_tick, max_tick = self.get_tick_range()
        return max_tick - min_tick

    def get_duration_seconds(self) -> float:
        """Get demo duration in seconds."""
        return self.get_total_ticks() / self.tick_rate
