"""
Event extractor module.

Handles extraction and enrichment of all game events from demos.
"""

from typing import Any

import structlog
from demoparser2 import DemoParser as DP2

from src.models.events import (
    ALL_EVENTS,
    BOMB_EVENTS,
    COMBAT_EVENTS,
    ESSENTIAL_EVENTS,
    HITGROUP_NAMES,
    ROUND_END_REASONS,
    ROUND_EVENTS,
    UTILITY_EVENTS,
)

logger = structlog.get_logger()


class EventExtractor:
    """
    Extracts and enriches game events from CS2 demos.

    Provides methods to extract specific event categories
    and enrich event data with additional context.
    """

    def __init__(self, parser: DP2) -> None:
        """Initialize with a demoparser2 instance."""
        self.parser = parser
        self.logger = logger.bind(extractor="events")

    def extract_all_events(self) -> list[dict[str, Any]]:
        """Extract all available events."""
        return self._extract_events(ALL_EVENTS)

    def extract_essential_events(self) -> list[dict[str, Any]]:
        """Extract only essential events for analysis."""
        return self._extract_events(ESSENTIAL_EVENTS)

    def extract_combat_events(self) -> list[dict[str, Any]]:
        """Extract combat-related events (kills, damage, etc.)."""
        return self._extract_events(COMBAT_EVENTS)

    def extract_round_events(self) -> list[dict[str, Any]]:
        """Extract round-related events."""
        return self._extract_events(ROUND_EVENTS)

    def extract_bomb_events(self) -> list[dict[str, Any]]:
        """Extract bomb-related events."""
        return self._extract_events(BOMB_EVENTS)

    def extract_utility_events(self) -> list[dict[str, Any]]:
        """Extract utility (grenade) events."""
        return self._extract_events(UTILITY_EVENTS)

    def _extract_events(self, event_names: list[str]) -> list[dict[str, Any]]:
        """Extract specified events and enrich them."""
        events = []

        for event_name in event_names:
            try:
                event_df = self.parser.parse_event(event_name)
                if len(event_df) > 0:
                    for _, row in event_df.iterrows():
                        event = self._enrich_event(event_name, row.to_dict())
                        events.append(event)
            except Exception as e:
                self.logger.debug(
                    "Event extraction failed",
                    event=event_name,
                    error=str(e),
                )

        # Sort by tick
        events.sort(key=lambda x: x.get("tick", 0))

        return events

    def _enrich_event(self, event_name: str, event_data: dict[str, Any]) -> dict[str, Any]:
        """Enrich event data with additional context."""
        event_data["event_name"] = event_name

        # Enrich player death events
        if event_name == "player_death":
            event_data = self._enrich_death_event(event_data)

        # Enrich player hurt events
        elif event_name == "player_hurt":
            event_data = self._enrich_hurt_event(event_data)

        # Enrich round end events
        elif event_name == "round_end":
            event_data = self._enrich_round_end_event(event_data)

        # Ensure steamids are strings
        for key in event_data:
            if "steamid" in key.lower() and event_data[key] is not None:
                event_data[key] = str(event_data[key])

        return event_data

    def _enrich_death_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Enrich death event with calculated fields."""
        # Determine if suicide
        attacker_id = event.get("attacker_steamid")
        victim_id = event.get("user_steamid") or event.get("victim_steamid")

        event["is_suicide"] = (
            attacker_id is None
            or attacker_id == "0"
            or attacker_id == victim_id
        )

        # Determine if team kill
        attacker_team = event.get("attacker_team")
        victim_team = event.get("user_team") or event.get("victim_team")

        event["is_teamkill"] = (
            attacker_team is not None
            and victim_team is not None
            and attacker_team == victim_team
            and not event["is_suicide"]
        )

        # Calculate distance if positions available
        if all(
            key in event
            for key in ["attacker_X", "attacker_Y", "attacker_Z", "user_X", "user_Y", "user_Z"]
        ):
            try:
                dx = float(event["attacker_X"]) - float(event["user_X"])
                dy = float(event["attacker_Y"]) - float(event["user_Y"])
                dz = float(event["attacker_Z"]) - float(event["user_Z"])
                event["distance"] = (dx**2 + dy**2 + dz**2) ** 0.5
            except (TypeError, ValueError):
                pass

        # Normalize field names
        if "user_steamid" in event and "victim_steamid" not in event:
            event["victim_steamid"] = event["user_steamid"]
        if "user_name" in event and "victim_name" not in event:
            event["victim_name"] = event["user_name"]

        return event

    def _enrich_hurt_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Enrich hurt event with hitgroup name."""
        hitgroup = event.get("hitgroup")
        if hitgroup is not None:
            event["hitgroup_name"] = HITGROUP_NAMES.get(int(hitgroup), "unknown")

        # Calculate if fatal
        health_remaining = event.get("health")
        if health_remaining is not None:
            event["is_fatal"] = int(health_remaining) <= 0

        # Normalize field names
        if "user_steamid" in event and "victim_steamid" not in event:
            event["victim_steamid"] = event["user_steamid"]

        return event

    def _enrich_round_end_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Enrich round end event with reason description."""
        reason = event.get("reason")
        if reason is not None:
            event["reason_name"] = ROUND_END_REASONS.get(int(reason), "unknown")

        # Determine winner team name
        winner = event.get("winner")
        if winner == 2:
            event["winner_team_name"] = "Terrorists"
        elif winner == 3:
            event["winner_team_name"] = "Counter-Terrorists"

        return event

    def extract_kill_feed(self) -> list[dict[str, Any]]:
        """
        Extract a simplified kill feed for display.

        Returns a list of kills with essential info only.
        """
        kill_feed = []

        try:
            deaths_df = self.parser.parse_event("player_death")

            for _, row in deaths_df.iterrows():
                kill_feed.append({
                    "tick": int(row.get("tick", 0)),
                    "attacker": str(row.get("attacker_name", "")),
                    "attacker_steamid": str(row.get("attacker_steamid", "")),
                    "victim": str(row.get("user_name", "")),
                    "victim_steamid": str(row.get("user_steamid", "")),
                    "weapon": str(row.get("weapon", "")),
                    "headshot": bool(row.get("headshot", False)),
                    "wallbang": int(row.get("penetrated", 0)) > 0,
                    "noscope": bool(row.get("noscope", False)),
                    "thrusmoke": bool(row.get("thrusmoke", False)),
                    "attackerblind": bool(row.get("attackerblind", False)),
                })
        except Exception as e:
            self.logger.warning("Failed to extract kill feed", error=str(e))

        return kill_feed

    def extract_damage_matrix(self) -> dict[str, dict[str, int]]:
        """
        Extract damage matrix showing who damaged whom.

        Returns nested dict: {attacker_steamid: {victim_steamid: total_damage}}
        """
        damage_matrix: dict[str, dict[str, int]] = {}

        try:
            hurt_df = self.parser.parse_event("player_hurt")

            for _, row in hurt_df.iterrows():
                attacker = str(row.get("attacker_steamid", ""))
                victim = str(row.get("user_steamid", ""))
                damage = int(row.get("dmg_health", 0))

                if attacker and victim and attacker != "0":
                    if attacker not in damage_matrix:
                        damage_matrix[attacker] = {}
                    if victim not in damage_matrix[attacker]:
                        damage_matrix[attacker][victim] = 0
                    damage_matrix[attacker][victim] += damage

        except Exception as e:
            self.logger.warning("Failed to extract damage matrix", error=str(e))

        return damage_matrix

    def extract_flash_effectiveness(self) -> list[dict[str, Any]]:
        """
        Extract flash effectiveness data.

        Returns info about each flash including who was blinded and for how long.
        """
        flash_data = []

        try:
            flash_df = self.parser.parse_event("flashbang_detonate")
            blind_df = self.parser.parse_event("player_blind")

            for _, flash_row in flash_df.iterrows():
                flash_tick = int(flash_row.get("tick", 0))

                # Find players blinded by this flash (within reasonable tick range)
                nearby_blinds = blind_df[
                    (blind_df["tick"] >= flash_tick)
                    & (blind_df["tick"] <= flash_tick + 10)
                ]

                blinded_players = []
                total_blind_time = 0.0
                enemies_blinded = 0
                teammates_blinded = 0

                thrower_team = flash_row.get("user_team")

                for _, blind_row in nearby_blinds.iterrows():
                    blind_duration = float(blind_row.get("blind_duration", 0))
                    victim_team = blind_row.get("user_team")

                    blinded_players.append({
                        "steamid": str(blind_row.get("user_steamid", "")),
                        "name": str(blind_row.get("user_name", "")),
                        "duration": blind_duration,
                        "is_enemy": victim_team != thrower_team,
                    })

                    total_blind_time += blind_duration

                    if victim_team != thrower_team:
                        enemies_blinded += 1
                    else:
                        teammates_blinded += 1

                flash_data.append({
                    "tick": flash_tick,
                    "thrower_steamid": str(flash_row.get("user_steamid", "")),
                    "thrower_name": str(flash_row.get("user_name", "")),
                    "X": float(flash_row.get("x", 0)),
                    "Y": float(flash_row.get("y", 0)),
                    "Z": float(flash_row.get("z", 0)),
                    "players_blinded": blinded_players,
                    "total_blind_time": total_blind_time,
                    "enemies_blinded": enemies_blinded,
                    "teammates_blinded": teammates_blinded,
                })

        except Exception as e:
            self.logger.warning("Failed to extract flash effectiveness", error=str(e))

        return flash_data
