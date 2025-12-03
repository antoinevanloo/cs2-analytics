"""Demo data extractors using demoparser2."""

from src.extractors.core import DemoParser
from src.extractors.events import EventExtractor
from src.extractors.ticks import TickExtractor
from src.extractors.metadata import MetadataExtractor
from src.extractors.grenades import GrenadeExtractor

__all__ = [
    "DemoParser",
    "EventExtractor",
    "TickExtractor",
    "MetadataExtractor",
    "GrenadeExtractor",
]
