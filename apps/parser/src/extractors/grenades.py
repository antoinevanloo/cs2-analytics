"""
Grenade trajectory extractor module.

Handles extraction of grenade throws and their trajectories.
"""

from typing import Any

import structlog
from demoparser2 import DemoParser as DP2

logger = structlog.get_logger()


class GrenadeExtractor:
    """
    Extracts grenade data from CS2 demos.

    Provides detailed information about grenade throws including:
    - Throw position and angle
    - Detonation position
    - Trajectory points
    - Players affected
    """

    def __init__(self, parser: DP2) -> None:
        """Initialize with a demoparser2 instance."""
        self.parser = parser
        self.logger = logger.bind(extractor="grenades")

    def extract_all_grenades(self) -> list[dict[str, Any]]:
        """Extract all grenade events."""
        grenades = []

        # Grenade throws (for trajectory start points)
        grenades.extend(self._extract_grenade_throws())

        # Smoke grenades
        grenades.extend(self._extract_smokes())

        # Flashbangs
        grenades.extend(self._extract_flashbangs())

        # HE grenades
        grenades.extend(self._extract_he_grenades())

        # Molotovs/Incendiaries
        grenades.extend(self._extract_molotovs())

        # Decoys
        grenades.extend(self._extract_decoys())

        # Sort by tick
        grenades.sort(key=lambda x: x.get("tick", 0))

        return grenades

    def _extract_grenade_throws(self) -> list[dict[str, Any]]:
        """Extract grenade throw events for trajectory visualization.

        These events capture the moment a grenade is thrown, providing:
        - Start position for trajectory
        - Thrower info
        - Entity ID to link with detonation event
        """
        throws = []

        # Try weapon_fire first (more reliable for throw position)
        try:
            fire_df = self.parser.parse_event("weapon_fire")
            grenade_weapons = [
                "weapon_smokegrenade",
                "weapon_flashbang",
                "weapon_hegrenade",
                "weapon_molotov",
                "weapon_incgrenade",
                "weapon_decoy",
            ]

            grenade_fires = fire_df[fire_df["weapon"].isin(grenade_weapons)]

            for _, row in grenade_fires.iterrows():
                weapon = str(row.get("weapon", ""))
                grenade_type = self._weapon_to_grenade_type(weapon)

                throws.append({
                    "type": grenade_type,
                    "event": "throw",
                    "tick": int(row.get("tick", 0)),
                    "X": float(row.get("user_X", row.get("x", 0))),
                    "Y": float(row.get("user_Y", row.get("y", 0))),
                    "Z": float(row.get("user_Z", row.get("z", 0))),
                    "thrower_steamid": str(row.get("user_steamid", "")),
                    "thrower_name": str(row.get("user_name", "")),
                    "thrower_team": int(row.get("user_team", 0)),
                    "yaw": float(row.get("user_yaw", row.get("yaw", 0))),
                    "pitch": float(row.get("user_pitch", row.get("pitch", 0))),
                })

        except Exception as e:
            self.logger.debug("Failed to extract grenade throws from weapon_fire", error=str(e))

        return throws

    def _weapon_to_grenade_type(self, weapon: str) -> str:
        """Convert weapon name to grenade type."""
        mapping = {
            "weapon_smokegrenade": "smoke",
            "weapon_flashbang": "flashbang",
            "weapon_hegrenade": "hegrenade",
            "weapon_molotov": "molotov",
            "weapon_incgrenade": "molotov",  # Incendiary = CT molotov
            "weapon_decoy": "decoy",
        }
        return mapping.get(weapon, "unknown")

    def _extract_smokes(self) -> list[dict[str, Any]]:
        """Extract smoke grenade events."""
        smokes = []

        try:
            # Detonation events
            detonate_df = self.parser.parse_event("smokegrenade_detonate")

            for _, row in detonate_df.iterrows():
                smokes.append({
                    "type": "smoke",
                    "event": "detonate",
                    "tick": int(row.get("tick", 0)),
                    "X": float(row.get("x", 0)),
                    "Y": float(row.get("y", 0)),
                    "Z": float(row.get("z", 0)),
                    "thrower_steamid": str(row.get("user_steamid", "")),
                    "thrower_name": str(row.get("user_name", "")),
                    "thrower_team": int(row.get("user_team", 0)),
                    "entity_id": int(row.get("entityid", 0)),
                })

            # Expired events
            try:
                expired_df = self.parser.parse_event("smokegrenade_expired")
                for _, row in expired_df.iterrows():
                    smokes.append({
                        "type": "smoke",
                        "event": "expired",
                        "tick": int(row.get("tick", 0)),
                        "X": float(row.get("x", 0)),
                        "Y": float(row.get("y", 0)),
                        "Z": float(row.get("z", 0)),
                        "entity_id": int(row.get("entityid", 0)),
                    })
            except Exception:
                pass

        except Exception as e:
            self.logger.debug("Failed to extract smokes", error=str(e))

        return smokes

    def _extract_flashbangs(self) -> list[dict[str, Any]]:
        """Extract flashbang events with blind data.

        Uses entity_id for precise flash-blind linking when available.
        Falls back to 10-tick temporal window for compatibility with older demos.
        """
        flashes = []

        try:
            detonate_df = self.parser.parse_event("flashbang_detonate")
            blind_df = self.parser.parse_event("player_blind")

            # Check if entity-based linking is available
            has_entity_linking = (
                "attacker_entity_id" in blind_df.columns
                if not blind_df.empty
                else False
            )

            for _, row in detonate_df.iterrows():
                flash_tick = int(row.get("tick", 0))
                flash_entity_id = int(row.get("entityid", 0))
                thrower_steamid = str(row.get("user_steamid", ""))
                thrower_team = int(row.get("user_team", 0))

                # Find players blinded by this flash
                # Priority 1: Use entity_id for precise linking (recommended)
                # Priority 2: Fall back to temporal window (legacy compatibility)
                if has_entity_linking and flash_entity_id > 0:
                    # Precise linking via entity_id
                    matching_blinds = blind_df[
                        blind_df["attacker_entity_id"] == flash_entity_id
                    ]
                else:
                    # Fallback: temporal window (10 ticks ~156ms at 64 tick)
                    matching_blinds = blind_df[
                        (blind_df["tick"] >= flash_tick)
                        & (blind_df["tick"] <= flash_tick + 10)
                    ]

                blinded = []
                enemies_blinded = 0
                teammates_blinded = 0
                total_blind_duration = 0.0

                for _, blind_row in matching_blinds.iterrows():
                    victim_team = int(blind_row.get("user_team", 0))
                    duration = float(blind_row.get("blind_duration", 0))

                    is_enemy = victim_team != thrower_team and victim_team != 0

                    blinded.append({
                        "steamid": str(blind_row.get("user_steamid", "")),
                        "name": str(blind_row.get("user_name", "")),
                        "team": victim_team,
                        "duration": duration,
                        "is_enemy": is_enemy,
                    })

                    total_blind_duration += duration
                    if is_enemy:
                        enemies_blinded += 1
                    elif victim_team == thrower_team:
                        teammates_blinded += 1

                flashes.append({
                    "type": "flashbang",
                    "event": "detonate",
                    "tick": flash_tick,
                    "X": float(row.get("x", 0)),
                    "Y": float(row.get("y", 0)),
                    "Z": float(row.get("z", 0)),
                    "thrower_steamid": thrower_steamid,
                    "thrower_name": str(row.get("user_name", "")),
                    "thrower_team": thrower_team,
                    "players_blinded": blinded,
                    "enemies_blinded": enemies_blinded,
                    "teammates_blinded": teammates_blinded,
                    "total_blind_duration": total_blind_duration,
                    "entity_id": int(row.get("entityid", 0)),
                })

        except Exception as e:
            self.logger.debug("Failed to extract flashbangs", error=str(e))

        return flashes

    def _extract_he_grenades(self) -> list[dict[str, Any]]:
        """Extract HE grenade events with damage data."""
        he_grenades = []

        try:
            detonate_df = self.parser.parse_event("hegrenade_detonate")
            hurt_df = self.parser.parse_event("player_hurt")

            for _, row in detonate_df.iterrows():
                he_tick = int(row.get("tick", 0))
                thrower_steamid = str(row.get("user_steamid", ""))
                thrower_team = int(row.get("user_team", 0))

                # Find damage caused by this HE (within ~10 ticks)
                nearby_damage = hurt_df[
                    (hurt_df["tick"] >= he_tick)
                    & (hurt_df["tick"] <= he_tick + 5)
                    & (hurt_df["weapon"] == "hegrenade")
                ]

                damaged = []
                total_damage = 0
                enemies_damaged = 0

                for _, damage_row in nearby_damage.iterrows():
                    victim_team = int(damage_row.get("user_team", 0))
                    damage = int(damage_row.get("dmg_health", 0))

                    is_enemy = victim_team != thrower_team and victim_team != 0

                    damaged.append({
                        "steamid": str(damage_row.get("user_steamid", "")),
                        "name": str(damage_row.get("user_name", "")),
                        "team": victim_team,
                        "damage": damage,
                        "is_enemy": is_enemy,
                    })

                    total_damage += damage
                    if is_enemy:
                        enemies_damaged += 1

                he_grenades.append({
                    "type": "hegrenade",
                    "event": "detonate",
                    "tick": he_tick,
                    "X": float(row.get("x", 0)),
                    "Y": float(row.get("y", 0)),
                    "Z": float(row.get("z", 0)),
                    "thrower_steamid": thrower_steamid,
                    "thrower_name": str(row.get("user_name", "")),
                    "thrower_team": thrower_team,
                    "players_damaged": damaged,
                    "total_damage": total_damage,
                    "enemies_damaged": enemies_damaged,
                    "entity_id": int(row.get("entityid", 0)),
                })

        except Exception as e:
            self.logger.debug("Failed to extract HE grenades", error=str(e))

        return he_grenades

    def _extract_molotovs(self) -> list[dict[str, Any]]:
        """Extract molotov/incendiary events with fire spread data."""
        molotovs = []

        try:
            detonate_df = self.parser.parse_event("molotov_detonate")

            for _, row in detonate_df.iterrows():
                molotovs.append({
                    "type": "molotov",
                    "event": "detonate",
                    "tick": int(row.get("tick", 0)),
                    "X": float(row.get("x", 0)),
                    "Y": float(row.get("y", 0)),
                    "Z": float(row.get("z", 0)),
                    "thrower_steamid": str(row.get("user_steamid", "")),
                    "thrower_name": str(row.get("user_name", "")),
                    "thrower_team": int(row.get("user_team", 0)),
                    "entity_id": int(row.get("entityid", 0)),
                })

            # Also get inferno start/end events for fire duration
            try:
                start_df = self.parser.parse_event("inferno_startburn")
                for _, row in start_df.iterrows():
                    molotovs.append({
                        "type": "inferno",
                        "event": "start",
                        "tick": int(row.get("tick", 0)),
                        "X": float(row.get("x", 0)),
                        "Y": float(row.get("y", 0)),
                        "Z": float(row.get("z", 0)),
                        "entity_id": int(row.get("entityid", 0)),
                    })
            except Exception:
                pass

            try:
                expire_df = self.parser.parse_event("inferno_expire")
                for _, row in expire_df.iterrows():
                    molotovs.append({
                        "type": "inferno",
                        "event": "expire",
                        "tick": int(row.get("tick", 0)),
                        "X": float(row.get("x", 0)),
                        "Y": float(row.get("y", 0)),
                        "Z": float(row.get("z", 0)),
                        "entity_id": int(row.get("entityid", 0)),
                    })
            except Exception:
                pass

        except Exception as e:
            self.logger.debug("Failed to extract molotovs", error=str(e))

        return molotovs

    def _extract_decoys(self) -> list[dict[str, Any]]:
        """Extract decoy grenade events."""
        decoys = []

        try:
            started_df = self.parser.parse_event("decoy_started")
            for _, row in started_df.iterrows():
                decoys.append({
                    "type": "decoy",
                    "event": "started",
                    "tick": int(row.get("tick", 0)),
                    "X": float(row.get("x", 0)),
                    "Y": float(row.get("y", 0)),
                    "Z": float(row.get("z", 0)),
                    "thrower_steamid": str(row.get("user_steamid", "")),
                    "thrower_name": str(row.get("user_name", "")),
                    "thrower_team": int(row.get("user_team", 0)),
                    "entity_id": int(row.get("entityid", 0)),
                })
        except Exception:
            pass

        try:
            detonate_df = self.parser.parse_event("decoy_detonate")
            for _, row in detonate_df.iterrows():
                decoys.append({
                    "type": "decoy",
                    "event": "detonate",
                    "tick": int(row.get("tick", 0)),
                    "X": float(row.get("x", 0)),
                    "Y": float(row.get("y", 0)),
                    "Z": float(row.get("z", 0)),
                    "entity_id": int(row.get("entityid", 0)),
                })
        except Exception:
            pass

        return decoys

    def get_grenade_summary(self) -> dict[str, Any]:
        """
        Get a summary of all grenades thrown in the match.

        Returns counts and effectiveness metrics.
        """
        grenades = self.extract_all_grenades()

        # Count by type
        counts: dict[str, int] = {}
        for g in grenades:
            if g.get("event") == "detonate" or g.get("event") == "started":
                g_type = g["type"]
                counts[g_type] = counts.get(g_type, 0) + 1

        # Calculate flash effectiveness
        flashes = [g for g in grenades if g["type"] == "flashbang"]
        total_flash_enemies = sum(g.get("enemies_blinded", 0) for g in flashes)
        total_flash_teammates = sum(g.get("teammates_blinded", 0) for g in flashes)

        # Calculate HE damage
        he_grenades = [g for g in grenades if g["type"] == "hegrenade"]
        total_he_damage = sum(g.get("total_damage", 0) for g in he_grenades)

        return {
            "total_grenades": sum(counts.values()),
            "by_type": counts,
            "flash_enemies_blinded": total_flash_enemies,
            "flash_teammates_blinded": total_flash_teammates,
            "he_total_damage": total_he_damage,
        }

    def get_player_grenades(self, steamid: str) -> list[dict[str, Any]]:
        """Get all grenades thrown by a specific player."""
        grenades = self.extract_all_grenades()
        return [g for g in grenades if g.get("thrower_steamid") == steamid]

    def get_grenades_in_round(
        self, round_start_tick: int, round_end_tick: int
    ) -> list[dict[str, Any]]:
        """Get all grenades thrown in a specific round."""
        grenades = self.extract_all_grenades()
        return [
            g
            for g in grenades
            if round_start_tick <= g.get("tick", 0) <= round_end_tick
        ]
