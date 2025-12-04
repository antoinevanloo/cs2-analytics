-- PostgreSQL Native Partitioning for High-Volume Tables
--
-- This script sets up range partitioning for GameEvent table
-- Partitioning improves query performance and enables efficient data archival
--
-- NOTE: Run AFTER Prisma migrations have created the base tables
-- Execute: docker exec -i cs2-postgres psql -U postgres -d cs2analytics -f /path/to/02-partitioning.sql

-- ============================================================================
-- GAMEEVENT PARTITIONING BY MONTH
-- ============================================================================
-- Range partitioning by createdAt enables:
-- - Faster queries on recent data
-- - Easy archival of old partitions
-- - Improved VACUUM performance

-- Step 1: Add createdAt column if not exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GameEvent') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GameEvent' AND column_name = 'createdAt') THEN
            ALTER TABLE "GameEvent" ADD COLUMN "createdAt" TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added createdAt column to GameEvent';
        END IF;
    END IF;
END $$;

-- Step 2: Create partitioned version of GameEvent
-- Note: This requires migration of existing data

-- Check if we need to create partitioned table
DO $$
DECLARE
    is_partitioned BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_partitioned_table pt
        JOIN pg_class c ON pt.partrelid = c.oid
        WHERE c.relname = 'GameEvent'
    ) INTO is_partitioned;

    IF NOT is_partitioned AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GameEvent') THEN
        RAISE NOTICE 'GameEvent is not partitioned. To enable partitioning, run the migration script.';
        RAISE NOTICE 'See: infrastructure/scripts/migrate-to-partitioned.sql';
    ELSIF is_partitioned THEN
        RAISE NOTICE 'GameEvent is already partitioned';
    END IF;
END $$;

-- ============================================================================
-- PARTITION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    partition_date DATE
) RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
    create_sql TEXT;
BEGIN
    start_date := date_trunc('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    partition_name := format('%s_%s', table_name, to_char(start_date, 'YYYY_MM'));

    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = partition_name
    ) THEN
        create_sql := format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name, table_name, start_date, end_date
        );
        EXECUTE create_sql;
        RAISE NOTICE 'Created partition: %', partition_name;
        RETURN partition_name;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create partitions for the next N months
CREATE OR REPLACE FUNCTION ensure_future_partitions(
    table_name TEXT,
    months_ahead INTEGER DEFAULT 3
) RETURNS INTEGER AS $$
DECLARE
    i INTEGER;
    partition_date DATE;
    created_count INTEGER := 0;
    result TEXT;
BEGIN
    FOR i IN 0..months_ahead LOOP
        partition_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        result := create_monthly_partition(table_name, partition_date::DATE);
        IF result IS NOT NULL THEN
            created_count := created_count + 1;
        END IF;
    END LOOP;
    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (for archival)
CREATE OR REPLACE FUNCTION drop_old_partitions(
    table_name TEXT,
    retention_months INTEGER DEFAULT 12
) RETURNS INTEGER AS $$
DECLARE
    partition_rec RECORD;
    cutoff_date DATE;
    dropped_count INTEGER := 0;
BEGIN
    cutoff_date := date_trunc('month', CURRENT_DATE) - (retention_months || ' months')::INTERVAL;

    FOR partition_rec IN
        SELECT inhrelid::regclass::text AS partition_name
        FROM pg_inherits
        WHERE inhparent = table_name::regclass
    LOOP
        -- Extract date from partition name and compare
        -- Pattern: tablename_YYYY_MM
        IF partition_rec.partition_name ~ '_[0-9]{4}_[0-9]{2}$' THEN
            -- This is a simplified check - in production, parse the date properly
            RAISE NOTICE 'Found partition: %', partition_rec.partition_name;
            -- DROP TABLE partition_name; -- Uncomment to actually drop
            dropped_count := dropped_count + 1;
        END IF;
    END LOOP;

    RETURN dropped_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTITION MAINTENANCE JOB
-- ============================================================================
-- Schedule this to run weekly via pg_cron or external scheduler

-- Create future partitions (run monthly)
-- SELECT ensure_future_partitions('"GameEvent"', 3);

-- Archive old partitions (run monthly, with caution)
-- SELECT drop_old_partitions('"GameEvent"', 12);

-- ============================================================================
-- PARTITION STATISTICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW partition_stats AS
SELECT
    parent.relname AS table_name,
    child.relname AS partition_name,
    pg_size_pretty(pg_relation_size(child.oid)) AS size,
    pg_stat_user_tables.n_live_tup AS row_count,
    pg_stat_user_tables.last_vacuum,
    pg_stat_user_tables.last_analyze
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
LEFT JOIN pg_stat_user_tables ON pg_stat_user_tables.relid = child.oid
WHERE parent.relname IN ('GameEvent', 'Kill')
ORDER BY parent.relname, child.relname;

COMMENT ON VIEW partition_stats IS 'View partition sizes and statistics for monitoring';
