-- TimescaleDB Hypertable Configuration
-- Convert high-volume event tables to hypertables for better performance
--
-- NOTE: This script should be run AFTER Prisma migrations
-- It converts regular tables to hypertables (time-series optimized)
--
-- Run manually: docker exec -i cs2-timescaledb psql -U postgres -d cs2analytics -f /docker-entrypoint-initdb.d/02-hypertables.sql

-- ============================================================================
-- GAMEEVENT HYPERTABLE
-- ============================================================================
-- GameEvent is the highest volume table - benefits most from hypertable
-- Partitioned by tick (proxy for time during demo playback)

DO $$
BEGIN
    -- Check if GameEvent table exists and is not already a hypertable
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GameEvent') THEN
        IF NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'GameEvent') THEN
            -- Add a created_at column for time-based partitioning if not exists
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GameEvent' AND column_name = 'createdAt') THEN
                ALTER TABLE "GameEvent" ADD COLUMN "createdAt" TIMESTAMPTZ DEFAULT NOW();
            END IF;

            -- Convert to hypertable, partitioned by createdAt
            -- chunk_time_interval of 1 day is good for demo analysis patterns
            PERFORM create_hypertable(
                '"GameEvent"',
                'createdAt',
                chunk_time_interval => INTERVAL '1 day',
                migrate_data => true
            );

            RAISE NOTICE 'GameEvent converted to hypertable';
        ELSE
            RAISE NOTICE 'GameEvent is already a hypertable';
        END IF;
    ELSE
        RAISE NOTICE 'GameEvent table does not exist yet - run Prisma migrations first';
    END IF;
END $$;

-- ============================================================================
-- KILL HYPERTABLE (Optional - High volume for detailed analysis)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Kill') THEN
        IF NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'Kill') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Kill' AND column_name = 'createdAt') THEN
                ALTER TABLE "Kill" ADD COLUMN "createdAt" TIMESTAMPTZ DEFAULT NOW();
            END IF;

            PERFORM create_hypertable(
                '"Kill"',
                'createdAt',
                chunk_time_interval => INTERVAL '7 days',
                migrate_data => true
            );

            RAISE NOTICE 'Kill converted to hypertable';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- COMPRESSION POLICIES
-- ============================================================================
-- Automatically compress data older than 7 days to save storage

DO $$
BEGIN
    -- Enable compression on GameEvent chunks older than 7 days
    IF EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'GameEvent') THEN
        ALTER TABLE "GameEvent" SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'demoId',
            timescaledb.compress_orderby = 'tick'
        );

        -- Add compression policy
        PERFORM add_compression_policy('"GameEvent"', INTERVAL '7 days');
        RAISE NOTICE 'Compression policy added for GameEvent';
    END IF;
END $$;

-- ============================================================================
-- RETENTION POLICIES (Optional)
-- ============================================================================
-- Automatically drop very old data (adjust based on business needs)

-- Example: Drop GameEvent data older than 1 year
-- SELECT add_retention_policy('"GameEvent"', INTERVAL '1 year');

-- ============================================================================
-- CONTINUOUS AGGREGATES (Optional)
-- ============================================================================
-- Pre-computed aggregates for common analytics queries

-- Example: Daily event counts by type
-- CREATE MATERIALIZED VIEW daily_event_stats
-- WITH (timescaledb.continuous) AS
-- SELECT
--     time_bucket('1 day', "createdAt") as bucket,
--     "demoId",
--     "eventName",
--     COUNT(*) as event_count
-- FROM "GameEvent"
-- GROUP BY bucket, "demoId", "eventName";

-- SELECT add_continuous_aggregate_policy('daily_event_stats',
--     start_offset => INTERVAL '3 days',
--     end_offset => INTERVAL '1 hour',
--     schedule_interval => INTERVAL '1 hour');
