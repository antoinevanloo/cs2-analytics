/**
 * User Module
 *
 * Provides user profile and preferences management.
 *
 * Features:
 * - User profile CRUD
 * - Preferences management
 * - Role-specific dashboard aggregation
 * - Onboarding state tracking
 *
 * @module user
 */

import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
