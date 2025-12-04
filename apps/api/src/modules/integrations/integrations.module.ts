/**
 * Integrations Module
 *
 * Provides third-party integration services for the API.
 *
 * Current integrations:
 * - FACEIT: Match history, player stats, demo downloads
 *
 * All integration services implement resilience patterns:
 * - Circuit breaker for fault tolerance
 * - Rate limiting to respect API quotas
 * - Retry with exponential backoff
 * - Response caching for performance
 *
 * @module integrations
 */

import { Module, Global } from "@nestjs/common";

import { FaceitService } from "./faceit.service";
import { FaceitController } from "./faceit.controller";

@Global()
@Module({
  controllers: [FaceitController],
  providers: [FaceitService],
  exports: [FaceitService],
})
export class IntegrationsModule {}
