/**
 * Redis Cache Service
 *
 * Provides a unified interface for Redis caching operations.
 * Uses ioredis for high-performance Redis connections.
 *
 * Features:
 * - Automatic JSON serialization/deserialization
 * - TTL-based expiration
 * - Batch operations (MGET/MSET)
 * - Graceful fallback on connection errors
 *
 * @module common/redis
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      const redisUrl = this.configService.get<string>("REDIS_URL");

      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn("Redis connection failed, operating without cache");
              return null; // Stop retrying
            }
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });
      } else {
        const host = this.configService.get("REDIS_HOST", "localhost");
        const port = this.configService.get("REDIS_PORT", 6379);
        this.client = new Redis({
          host,
          port,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn("Redis connection failed, operating without cache");
              return null;
            }
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });
      }

      this.client.on("connect", () => {
        this.isConnected = true;
        this.logger.log("Redis connected");
      });

      this.client.on("error", (error) => {
        this.isConnected = false;
        this.logger.warn(`Redis error: ${error.message}`);
      });

      this.client.on("close", () => {
        this.isConnected = false;
        this.logger.debug("Redis connection closed");
      });

      await this.client.connect();
    } catch (error) {
      this.logger.warn(`Failed to connect to Redis: ${error}. Operating without cache.`);
      this.client = null;
    }
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.isConnected;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client!.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.debug(`Cache get error for ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL (in milliseconds)
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.client!.psetex(key, ttlMs, serialized);
      return true;
    } catch (error) {
      this.logger.debug(`Cache set error for ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      this.logger.debug(`Cache delete error for ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client!.del(...keys);
    } catch (error) {
      this.logger.debug(`Cache deletePattern error for ${pattern}: ${error}`);
      return 0;
    }
  }

  /**
   * Get multiple values from cache (MGET)
   * Returns a Map of key -> value (null values for cache misses)
   */
  async getMany<T>(keys: readonly string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    if (!this.isAvailable() || keys.length === 0) {
      keys.forEach((key) => result.set(key, null));
      return result;
    }

    try {
      const values = await this.client!.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            result.set(key, JSON.parse(value) as T);
          } catch {
            result.set(key, null);
          }
        } else {
          result.set(key, null);
        }
      });
      return result;
    } catch (error) {
      this.logger.debug(`Cache getMany error: ${error}`);
      keys.forEach((key) => result.set(key, null));
      return result;
    }
  }

  /**
   * Set multiple values in cache with TTL (in milliseconds)
   */
  async setMany<T>(entries: ReadonlyMap<string, T>, ttlMs: number): Promise<boolean> {
    if (!this.isAvailable() || entries.size === 0) return false;

    try {
      const pipeline = this.client!.pipeline();
      entries.forEach((value, key) => {
        pipeline.psetex(key, ttlMs, JSON.stringify(value));
      });
      await pipeline.exec();
      return true;
    } catch (error) {
      this.logger.debug(`Cache setMany error: ${error}`);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const count = await this.client!.exists(key);
      return count > 0;
    } catch (error) {
      this.logger.debug(`Cache exists error for ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Get time-to-live for a key (in milliseconds)
   */
  async getTtl(key: string): Promise<number | null> {
    if (!this.isAvailable()) return null;

    try {
      const ttl = await this.client!.pttl(key);
      return ttl > 0 ? ttl : null;
    } catch (error) {
      this.logger.debug(`Cache getTtl error for ${key}: ${error}`);
      return null;
    }
  }
}
