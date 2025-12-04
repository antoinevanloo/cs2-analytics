-- Create replication user for read replicas
-- This script runs on the primary PostgreSQL instance

-- Create replication role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'replicator') THEN
        CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator_password';
        RAISE NOTICE 'Replication user created';
    ELSE
        RAISE NOTICE 'Replication user already exists';
    END IF;
END $$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE cs2analytics TO replicator;

-- Add to pg_hba.conf entries (handled by Docker env vars)
-- host replication replicator 0.0.0.0/0 scram-sha-256
