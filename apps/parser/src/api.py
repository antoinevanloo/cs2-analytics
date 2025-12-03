"""
FastAPI application for the CS2 demo parser microservice.

Provides REST API and streaming endpoints for demo parsing.
"""

import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

import aiofiles
import structlog
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from src.config import Settings, get_settings
from src.extractors.core import DemoParser
from src.models.events import ALL_EVENTS, ESSENTIAL_EVENTS
from src.models.output import ParseProgress, ParseRequest, ParseResult
from src.models.properties import ALL_PLAYER_PROPS, HIGH_FREQUENCY_PROPS
from src.streaming.writer import stream_to_bytes

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# In-memory job tracking (use Redis in production)
parse_jobs: dict[str, ParseProgress] = {}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler."""
    logger.info("Starting CS2 Parser Service")
    yield
    logger.info("Shutting down CS2 Parser Service")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = settings or get_settings()

    app = FastAPI(
        title="CS2 Demo Parser",
        description="Exhaustive CS2 demo parsing microservice using demoparser2",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store settings in app state
    app.state.settings = settings

    return app


app = create_app()


# ============================================================================
# Health & Info Endpoints
# ============================================================================


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/info")
async def get_info() -> dict[str, Any]:
    """Get parser information and capabilities."""
    return {
        "service": "cs2-parser",
        "version": "0.1.0",
        "parser": "demoparser2",
        "capabilities": {
            "events": len(ALL_EVENTS),
            "properties": len(ALL_PLAYER_PROPS),
            "streaming": True,
            "formats": ["json", "ndjson"],
        },
        "available_events": ALL_EVENTS,
        "available_properties": ALL_PLAYER_PROPS,
        "essential_events": ESSENTIAL_EVENTS,
        "high_frequency_properties": HIGH_FREQUENCY_PROPS,
    }


# ============================================================================
# Parsing Endpoints
# ============================================================================


@app.post("/parse/upload")
async def parse_uploaded_demo(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_ticks: bool = Query(True, description="Extract tick-by-tick data"),
    tick_interval: int = Query(1, description="Extract every N ticks"),
    extract_grenades: bool = Query(True, description="Extract grenade data"),
    extract_chat: bool = Query(True, description="Extract chat messages"),
) -> dict[str, Any]:
    """
    Upload and parse a demo file.

    Returns immediately with a job ID for async processing.
    """
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(400, "File must be a .dem file")

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Save uploaded file
    settings = app.state.settings
    demo_dir = Path(settings.local_demo_path)
    demo_dir.mkdir(parents=True, exist_ok=True)

    demo_path = demo_dir / f"{job_id}.dem"

    async with aiofiles.open(demo_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Initialize job status
    parse_jobs[job_id] = ParseProgress(
        demo_id=job_id,
        status="queued",
        progress_percent=0,
    )

    # Start background parsing
    background_tasks.add_task(
        parse_demo_background,
        job_id,
        str(demo_path),
        extract_ticks,
        tick_interval,
        extract_grenades,
        extract_chat,
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Demo uploaded and queued for parsing",
    }


@app.post("/parse/path")
async def parse_demo_from_path(
    request: ParseRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Parse a demo file from a local path.

    Returns immediately with a job ID for async processing.
    """
    if not request.demo_path:
        raise HTTPException(400, "demo_path is required")

    if not Path(request.demo_path).exists():
        raise HTTPException(404, f"Demo file not found: {request.demo_path}")

    job_id = request.demo_id or str(uuid.uuid4())

    parse_jobs[job_id] = ParseProgress(
        demo_id=job_id,
        status="queued",
        progress_percent=0,
    )

    background_tasks.add_task(
        parse_demo_background,
        job_id,
        request.demo_path,
        request.extract_ticks,
        request.tick_interval,
        request.extract_grenades,
        request.extract_chat,
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Demo queued for parsing",
    }


@app.get("/parse/status/{job_id}")
async def get_parse_status(job_id: str) -> ParseProgress:
    """Get the status of a parsing job."""
    if job_id not in parse_jobs:
        raise HTTPException(404, f"Job not found: {job_id}")

    return parse_jobs[job_id]


@app.post("/parse/sync")
async def parse_demo_sync(
    file: UploadFile = File(...),
    extract_ticks: bool = Query(False, description="Extract tick data (slower)"),
    tick_interval: int = Query(64, description="Extract every N ticks"),
    extract_grenades: bool = Query(True, description="Extract grenade data"),
    extract_chat: bool = Query(True, description="Extract chat messages"),
) -> dict[str, Any]:
    """
    Parse a demo file synchronously.

    Returns parsed data directly. Best for smaller demos or when
    tick data is not needed.
    """
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(400, "File must be a .dem file")

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".dem", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parser = DemoParser()
        result = parser.parse(
            tmp_path,
            extract_ticks=extract_ticks,
            tick_interval=tick_interval,
            extract_grenades=extract_grenades,
            extract_chat=extract_chat,
        )

        return result.model_dump()

    finally:
        os.unlink(tmp_path)


@app.post("/parse/stream")
async def parse_demo_stream(
    file: UploadFile = File(...),
    chunk_size: int = Query(10000, description="Ticks per chunk"),
) -> StreamingResponse:
    """
    Parse a demo file with streaming response.

    Returns NDJSON stream of chunks for incremental processing.
    """
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(400, "File must be a .dem file")

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".dem", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    async def generate() -> AsyncGenerator[bytes, None]:
        try:
            parser = DemoParser()
            for chunk_bytes in stream_to_bytes(
                parser.parse_streaming(tmp_path, chunk_size=chunk_size)
            ):
                yield chunk_bytes
        finally:
            os.unlink(tmp_path)

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"X-Content-Type-Options": "nosniff"},
    )


# ============================================================================
# Data Extraction Endpoints
# ============================================================================


@app.post("/extract/events")
async def extract_events(
    file: UploadFile = File(...),
    events: list[str] = Query(default=None, description="Specific events to extract"),
) -> dict[str, Any]:
    """Extract only events from a demo file."""
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(400, "File must be a .dem file")

    with tempfile.NamedTemporaryFile(suffix=".dem", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parser = DemoParser()
        result = parser.parse(
            tmp_path,
            extract_ticks=False,
            extract_grenades=False,
            extract_chat=False,
            events=events or ESSENTIAL_EVENTS,
        )

        return {
            "metadata": result.metadata.model_dump(),
            "events": result.events,
        }

    finally:
        os.unlink(tmp_path)


@app.post("/extract/metadata")
async def extract_metadata(file: UploadFile = File(...)) -> dict[str, Any]:
    """Extract only metadata from a demo file."""
    if not file.filename or not file.filename.endswith(".dem"):
        raise HTTPException(400, "File must be a .dem file")

    with tempfile.NamedTemporaryFile(suffix=".dem", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parser = DemoParser()
        result = parser.parse(
            tmp_path,
            extract_ticks=False,
            extract_grenades=False,
            extract_chat=False,
        )

        return {
            "metadata": result.metadata.model_dump(),
            "players": [p.model_dump() for p in result.players],
            "rounds": [r.model_dump() for r in result.rounds],
        }

    finally:
        os.unlink(tmp_path)


# ============================================================================
# Background Tasks
# ============================================================================


async def parse_demo_background(
    job_id: str,
    demo_path: str,
    extract_ticks: bool,
    tick_interval: int,
    extract_grenades: bool,
    extract_chat: bool,
) -> None:
    """Background task to parse a demo file."""
    try:
        parse_jobs[job_id].status = "parsing"
        parse_jobs[job_id].progress_percent = 10

        parser = DemoParser()
        start_time = time.time()

        result = parser.parse(
            demo_path,
            extract_ticks=extract_ticks,
            tick_interval=tick_interval,
            extract_grenades=extract_grenades,
            extract_chat=extract_chat,
        )

        parse_time = time.time() - start_time

        # Save result to file
        settings = app.state.settings
        output_dir = Path(settings.local_demo_path) / "parsed"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{job_id}.json.gz"

        from src.streaming.writer import JSONWriter

        writer = JSONWriter(output_path, compress=True)
        writer.write_complete(result)
        writer.finalize()

        parse_jobs[job_id].status = "complete"
        parse_jobs[job_id].progress_percent = 100
        parse_jobs[job_id].events_extracted = len(result.events)

        logger.info(
            "Demo parsed successfully",
            job_id=job_id,
            parse_time=f"{parse_time:.2f}s",
            events=len(result.events),
        )

    except Exception as e:
        parse_jobs[job_id].status = "error"
        parse_jobs[job_id].error_message = str(e)
        logger.error("Demo parsing failed", job_id=job_id, error=str(e))


# ============================================================================
# Entry Point
# ============================================================================


def main() -> None:
    """Run the parser service."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.api:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
