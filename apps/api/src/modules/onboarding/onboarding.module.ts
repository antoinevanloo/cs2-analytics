/**
 * Onboarding Module
 *
 * Provides onboarding flow functionality including step tracking,
 * match import, and first insight generation.
 *
 * @module onboarding
 */

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "demo-import",
    }),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
