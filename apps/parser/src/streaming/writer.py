"""
Streaming output writers for parsed demo data.

Supports multiple output formats optimized for different use cases.
"""

import gzip
import io
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Generator

import orjson
import structlog

from src.models.output import ParsedDemo, StreamingChunk

logger = structlog.get_logger()


class StreamingWriter(ABC):
    """Abstract base class for streaming writers."""

    def __init__(self, output_path: str | Path, compress: bool = True) -> None:
        """Initialize writer with output path."""
        self.output_path = Path(output_path)
        self.compress = compress
        self.logger = logger.bind(writer=self.__class__.__name__)

    @abstractmethod
    def write_chunk(self, chunk: StreamingChunk) -> None:
        """Write a single chunk of data."""
        pass

    @abstractmethod
    def write_complete(self, data: ParsedDemo) -> None:
        """Write complete parsed data."""
        pass

    @abstractmethod
    def finalize(self) -> None:
        """Finalize the output (close files, etc.)."""
        pass


class NDJSONWriter(StreamingWriter):
    """
    Newline-delimited JSON writer.

    Each line is a complete JSON object, making it easy to
    stream and process incrementally.
    """

    def __init__(self, output_path: str | Path, compress: bool = True) -> None:
        """Initialize NDJSON writer."""
        super().__init__(output_path, compress)

        # Add .gz extension if compressing
        if compress and not str(self.output_path).endswith(".gz"):
            self.output_path = Path(str(self.output_path) + ".gz")

        self._file: io.IOBase | None = None
        self._open_file()

    def _open_file(self) -> None:
        """Open the output file."""
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

        if self.compress:
            self._file = gzip.open(self.output_path, "wb")
        else:
            self._file = open(self.output_path, "wb")

    def write_chunk(self, chunk: StreamingChunk) -> None:
        """Write a streaming chunk as NDJSON."""
        if self._file is None:
            raise RuntimeError("Writer not initialized")

        data = {
            "chunk_type": chunk.chunk_type,
            "chunk_index": chunk.chunk_index,
            "total_chunks": chunk.total_chunks,
            "data": chunk.data,
        }

        line = orjson.dumps(data) + b"\n"
        self._file.write(line)

    def write_complete(self, data: ParsedDemo) -> None:
        """Write complete parsed data as NDJSON."""
        if self._file is None:
            raise RuntimeError("Writer not initialized")

        # Write metadata
        self._write_line({"type": "metadata", "data": data.metadata.model_dump()})

        # Write players
        self._write_line({
            "type": "players",
            "data": [p.model_dump() for p in data.players],
        })

        # Write rounds
        self._write_line({
            "type": "rounds",
            "data": [r.model_dump() for r in data.rounds],
        })

        # Write events in batches
        batch_size = 1000
        for i in range(0, len(data.events), batch_size):
            batch = data.events[i : i + batch_size]
            self._write_line({
                "type": "events",
                "batch_index": i // batch_size,
                "data": batch,
            })

        # Write ticks in batches if present
        if data.ticks:
            for i in range(0, len(data.ticks), batch_size):
                batch = data.ticks[i : i + batch_size]
                self._write_line({
                    "type": "ticks",
                    "batch_index": i // batch_size,
                    "data": [t.model_dump() for t in batch],
                })

        # Write grenades
        if data.grenades:
            self._write_line({"type": "grenades", "data": data.grenades})

        # Write chat
        if data.chat_messages:
            self._write_line({"type": "chat", "data": data.chat_messages})

    def _write_line(self, data: dict[str, Any]) -> None:
        """Write a single line of NDJSON."""
        if self._file:
            line = orjson.dumps(data) + b"\n"
            self._file.write(line)

    def finalize(self) -> None:
        """Close the output file."""
        if self._file:
            self._file.close()
            self._file = None
            self.logger.info("Output finalized", path=str(self.output_path))


class JSONWriter(StreamingWriter):
    """
    Standard JSON writer.

    Writes complete data as a single JSON file.
    Better for smaller demos or when random access is needed.
    """

    def __init__(self, output_path: str | Path, compress: bool = True) -> None:
        """Initialize JSON writer."""
        super().__init__(output_path, compress)

        if compress and not str(self.output_path).endswith(".gz"):
            self.output_path = Path(str(self.output_path) + ".gz")

        self._chunks: list[StreamingChunk] = []

    def write_chunk(self, chunk: StreamingChunk) -> None:
        """Buffer a chunk for later writing."""
        self._chunks.append(chunk)

    def write_complete(self, data: ParsedDemo) -> None:
        """Write complete parsed data as JSON."""
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

        json_data = orjson.dumps(
            data.model_dump(),
            option=orjson.OPT_INDENT_2,
        )

        if self.compress:
            with gzip.open(self.output_path, "wb") as f:
                f.write(json_data)
        else:
            with open(self.output_path, "wb") as f:
                f.write(json_data)

        self.logger.info("Output written", path=str(self.output_path))

    def finalize(self) -> None:
        """Write buffered chunks to file."""
        if not self._chunks:
            return

        self.output_path.parent.mkdir(parents=True, exist_ok=True)

        # Reconstruct data from chunks
        combined_data: dict[str, Any] = {}

        for chunk in self._chunks:
            if chunk.chunk_type == "metadata":
                combined_data["metadata"] = chunk.data
            elif chunk.chunk_type == "players":
                combined_data["players"] = chunk.data.get("players", [])
            elif chunk.chunk_type == "rounds":
                combined_data["rounds"] = chunk.data.get("rounds", [])
            elif chunk.chunk_type == "events":
                if "events" not in combined_data:
                    combined_data["events"] = []
                combined_data["events"].extend(chunk.data.get("events", []))
            elif chunk.chunk_type == "ticks":
                if "ticks" not in combined_data:
                    combined_data["ticks"] = []
                combined_data["ticks"].extend(chunk.data.get("ticks", []))
            elif chunk.chunk_type == "grenades":
                combined_data["grenades"] = chunk.data.get("grenades", [])

        json_data = orjson.dumps(combined_data, option=orjson.OPT_INDENT_2)

        if self.compress:
            with gzip.open(self.output_path, "wb") as f:
                f.write(json_data)
        else:
            with open(self.output_path, "wb") as f:
                f.write(json_data)

        self._chunks.clear()
        self.logger.info("Chunks finalized", path=str(self.output_path))


def create_writer(
    output_path: str | Path,
    format: str = "ndjson",
    compress: bool = True,
) -> StreamingWriter:
    """Factory function to create appropriate writer."""
    if format == "ndjson":
        return NDJSONWriter(output_path, compress)
    elif format == "json":
        return JSONWriter(output_path, compress)
    else:
        raise ValueError(f"Unknown format: {format}")


def stream_to_bytes(
    chunks: Generator[StreamingChunk, None, None],
    format: str = "ndjson",
) -> Generator[bytes, None, None]:
    """
    Stream chunks to bytes for HTTP streaming responses.

    Yields bytes that can be sent directly to clients.
    """
    for chunk in chunks:
        data = {
            "chunk_type": chunk.chunk_type,
            "chunk_index": chunk.chunk_index,
            "total_chunks": chunk.total_chunks,
            "data": chunk.data,
        }

        if format == "ndjson":
            yield orjson.dumps(data) + b"\n"
        else:
            yield orjson.dumps(data)
