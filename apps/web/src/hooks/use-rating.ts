/**
 * Custom hooks for HLTV Rating 2.0 data fetching
 *
 * Provides React Query hooks for:
 * - Demo ratings (all players)
 * - Player-specific rating
 * - Rating history
 * - Rating simulation
 * - Improvement suggestions
 * - Leaderboard
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ratingsApi,
  type RatingComponents,
  type DemoRatingsResponse,
  type RatingHistoryResponse,
  type RatingSimulationResponse,
  type RatingImprovementsResponse,
  type DemoLeaderboardResponse,
} from "@/lib/api";

/**
 * Get all player ratings for a demo
 */
export function useDemoRatings(demoId: string) {
  return useQuery<DemoRatingsResponse>({
    queryKey: ["demo-ratings", demoId],
    queryFn: () => ratingsApi.getDemoRatings(demoId),
    enabled: !!demoId,
  });
}

/**
 * Get detailed rating for a specific player in a demo
 */
export function usePlayerRating(demoId: string, steamId: string) {
  return useQuery({
    queryKey: ["player-rating", demoId, steamId],
    queryFn: () => ratingsApi.getPlayerRating(demoId, steamId),
    enabled: !!demoId && !!steamId,
  });
}

/**
 * Get rating history for a player across matches
 */
export function useRatingHistory(
  steamId: string,
  options?: { limit?: number; map?: string },
) {
  return useQuery<RatingHistoryResponse>({
    queryKey: ["rating-history", steamId, options],
    queryFn: () => ratingsApi.getRatingHistory(steamId, options),
    enabled: !!steamId,
  });
}

/**
 * Get demo leaderboard sorted by rating
 */
export function useDemoLeaderboard(demoId: string) {
  return useQuery<DemoLeaderboardResponse>({
    queryKey: ["demo-leaderboard", demoId],
    queryFn: () => ratingsApi.getLeaderboard(demoId),
    enabled: !!demoId,
  });
}

/**
 * Get improvement suggestions for a player
 */
export function useRatingImprovements(
  demoId: string,
  steamId: string,
  targetRating?: number,
) {
  return useQuery<RatingImprovementsResponse>({
    queryKey: ["rating-improvements", demoId, steamId, targetRating],
    queryFn: () => ratingsApi.getImprovements(demoId, steamId, targetRating),
    enabled: !!demoId && !!steamId,
  });
}

/**
 * Mutation hook for simulating rating with modified stats
 */
export function useRatingSimulation() {
  return useMutation<
    RatingSimulationResponse,
    Error,
    {
      demoId: string;
      steamId: string;
      modifications: Partial<RatingComponents>;
    }
  >({
    mutationFn: ({ demoId, steamId, modifications }) =>
      ratingsApi.simulateRating(demoId, steamId, modifications),
  });
}

/**
 * Prefetch demo ratings for faster navigation
 */
export function usePrefetchDemoRatings() {
  return (demoId: string) => {
    // This would be called with queryClient.prefetchQuery
    return {
      queryKey: ["demo-ratings", demoId],
      queryFn: () => ratingsApi.getDemoRatings(demoId),
    };
  };
}
