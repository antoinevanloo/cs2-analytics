/**
 * Redis Module
 *
 * Global module for Redis caching.
 * Provides RedisService for all modules.
 *
 * @module common/redis
 */

import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
