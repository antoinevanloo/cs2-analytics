/**
 * API client for communicating with the backend
 */

import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ============================================================================
// Auth Helper
// ============================================================================

async function getValidAuthToken(): Promise<string | null> {
  return useAuthStore.getState().getValidAccessToken();
}

// ============================================================================
// API Response Types
// ============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Demo types
export interface DemoListItem {
  id: string;
  filename: string;
  mapName: string | null;
  status: "pending" | "parsing" | "completed" | "failed";
  uploadedAt: string;
  parsedAt: string | null;
  team1Score: number | null;
  team2Score: number | null;
  team1Name: string | null;
  team2Name: string | null;
  durationSeconds: number | null;
  playerCount: number | null;
}

export interface DemoListResponse {
  demos: DemoListItem[];
  pagination: PaginationInfo;
}

export interface DemoDetail extends DemoListItem {
  fileSize: number;
  tickRate: number | null;
  totalTicks: number | null;
  rounds: RoundSummary[];
  players: PlayerSummary[];
}

export interface RoundSummary {
  roundNumber: number;
  winner: "T" | "CT";
  winReason: string;
  ctScore: number;
  tScore: number;
}

export interface PlayerSummary {
  steamId: string;
  name: string;
  team: "T" | "CT";
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  rating: number | null;
}

export interface DemoUploadResponse {
  id: string;
  filename: string;
  status: string;
}

export interface DemoStatusResponse {
  id: string;
  status: "pending" | "parsing" | "completed" | "failed";
  progress: number;
  error: string | null;
}

// Player types
export interface PlayerProfile {
  steamId: string;
  name: string;
  avatarUrl: string | null;
  team: string | null;
  matchCount: number;
  stats: PlayerStats;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  rating: number;
  headshotPercentage: number;
  clutchesWon: number;
  firstKills: number;
}

export interface PlayerMatch {
  demoId: string;
  mapName: string;
  playedAt: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  won: boolean;
}

// Analysis types
export interface AnalysisOverview {
  teamStats: {
    t: TeamStats;
    ct: TeamStats;
  };
  roundStats: RoundStats;
  economyStats: EconomyStats;
}

export interface TeamStats {
  roundsWon: number;
  kills: number;
  deaths: number;
  avgAdr: number;
}

export interface RoundStats {
  total: number;
  tWins: number;
  ctWins: number;
  bombPlants: number;
  bombDefuses: number;
  bombExplosions: number;
}

export interface EconomyStats {
  avgBuyValue: number;
  ecoBuys: number;
  fullBuys: number;
  forceBuys: number;
}

// Player search response
export interface PlayerSearchItem {
  steamId: string;
  name: string;
  team: string | null;
  totalMatches: number;
  totalKills: number;
  totalDeaths: number;
  totalDamage: number;
  totalRounds: number;
  totalHsKills: number;
  rating: number | null;
}

export interface PlayerSearchResponse {
  players: PlayerSearchItem[];
  total: number;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  // Get valid auth token (auto-refreshes if expired)
  const token = await getValidAuthToken();

  // Build headers with auth
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }

  return response.json();
}

// Demo endpoints
export const demosApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    map?: string;
  }): Promise<DemoListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.map) searchParams.set("map", params.map);

    return fetchApi<DemoListResponse>(`/v1/demos?${searchParams}`);
  },

  get: (id: string): Promise<DemoDetail> =>
    fetchApi<DemoDetail>(`/v1/demos/${id}`),

  getStatus: (id: string): Promise<DemoStatusResponse> =>
    fetchApi<DemoStatusResponse>(`/v1/demos/${id}/status`),

  getEvents: (id: string, params?: { type?: string; round?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set("type", params.type);
    if (params?.round) searchParams.set("round", params.round.toString());

    return fetchApi(`/v1/demos/${id}/events?${searchParams}`);
  },

  getRounds: (id: string): Promise<RoundSummary[]> =>
    fetchApi<RoundSummary[]>(`/v1/demos/${id}/rounds`),

  getPlayers: (id: string): Promise<PlayerSummary[]> =>
    fetchApi<PlayerSummary[]>(`/v1/demos/${id}/players`),

  upload: async (file: File): Promise<DemoUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    // Get valid auth token
    const token = await getValidAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/v1/demos/upload`, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    return response.json();
  },

  parse: (
    id: string,
    options?: { extractTicks?: boolean; tickInterval?: number },
  ) =>
    fetchApi(`/v1/demos/${id}/parse`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  // Download demo file
  download: async (id: string, filename: string): Promise<void> => {
    const response = await fetch(`${API_URL}/v1/demos/${id}/download`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Download failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `demo-${id}.dem`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Delete demo
  delete: (id: string) =>
    fetchApi(`/v1/demos/${id}`, {
      method: "DELETE",
    }),
};

// Player endpoints
export const playersApi = {
  get: (steamId: string): Promise<PlayerProfile> =>
    fetchApi(`/v1/players/${steamId}`),

  getStats: (steamId: string, params?: { map?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.map) searchParams.set("map", params.map);
    if (params?.days) searchParams.set("days", params.days.toString());

    return fetchApi(`/v1/players/${steamId}/stats?${searchParams}`);
  },

  getMatches: (steamId: string, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    return fetchApi(`/v1/players/${steamId}/matches?${searchParams}`);
  },

  getHeatmap: (steamId: string, map: string, side?: "T" | "CT") => {
    const searchParams = new URLSearchParams({ map });
    if (side) searchParams.set("side", side);

    return fetchApi(`/v1/players/${steamId}/heatmap?${searchParams}`);
  },

  search: (params: {
    name?: string;
    team?: string;
  }): Promise<PlayerSearchResponse> => {
    const searchParams = new URLSearchParams();
    if (params.name) searchParams.set("name", params.name);
    if (params.team) searchParams.set("team", params.team);

    return fetchApi<PlayerSearchResponse>(`/v1/players?${searchParams}`);
  },
};

// Round endpoints
export const roundsApi = {
  get: (demoId: string, roundNumber: number) =>
    fetchApi(`/v1/rounds/${demoId}/${roundNumber}`),

  getTimeline: (demoId: string, roundNumber: number) =>
    fetchApi(`/v1/rounds/${demoId}/${roundNumber}/timeline`),

  getEconomy: (demoId: string, roundNumber: number) =>
    fetchApi(`/v1/rounds/${demoId}/${roundNumber}/economy`),

  getReplay: (demoId: string, roundNumber: number, interval?: number) => {
    const searchParams = new URLSearchParams();
    if (interval) searchParams.set("interval", interval.toString());

    return fetchApi(
      `/v1/rounds/${demoId}/${roundNumber}/replay?${searchParams}`,
    );
  },

  getKillfeed: (demoId: string, roundNumber: number) =>
    fetchApi(`/v1/rounds/${demoId}/${roundNumber}/killfeed`),
};

// Rating types
export interface RatingComponents {
  kast: number;
  kpr: number;
  dpr: number;
  impact: number;
  adr: number;
}

export interface RatingContributions {
  kastContribution: number;
  kprContribution: number;
  dprContribution: number;
  impactContribution: number;
  adrContribution: number;
  constant: number;
}

export interface RatingBenchmarks {
  averageForRank: number | null;
  percentile: number | null;
  label: string;
}

export interface HLTVRating {
  rating: number;
  components: RatingComponents;
  contributions: RatingContributions;
  benchmarks: RatingBenchmarks;
}

export interface PlayerRating {
  steamId: string;
  name: string;
  team: number;
  // Raw combat stats for scoreboard display
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  // HLTV Rating 2.0
  rating: HLTVRating;
  ratingLabel: string;
  // Summary metrics for advanced display
  summary: {
    kast: number;
    adr: number;
    kd: number;
    hsPercent: number;
    impact: number;
    kpr: number;
    dpr: number;
  };
}

export interface DemoRatingsResponse {
  demoId: string;
  players: PlayerRating[];
  teamAverages: {
    team1: { avgRating: number; label: string; playerCount: number };
    team2: { avgRating: number; label: string; playerCount: number };
  };
  mvp: PlayerRating | null;
}

export interface RatingHistoryEntry {
  demoId: string;
  map: string;
  playedAt: string | null;
  score: string;
  rating: number;
  ratingLabel: string;
  components: RatingComponents;
  kd: number;
  adr: number;
}

export interface RatingHistoryResponse {
  steamId: string;
  matchCount: number;
  history: RatingHistoryEntry[];
  statistics: {
    avgRating: number;
    minRating: number;
    maxRating: number;
    trend: number;
    trendLabel: string;
  };
}

export interface RatingSimulationResponse {
  demoId: string;
  steamId: string;
  name: string;
  original: {
    rating: number;
    label: string;
    components: RatingComponents;
  };
  simulated: {
    rating: number;
    label: string;
    components: RatingComponents;
  };
  change: number;
  changePercent: number;
  modifications: Partial<RatingComponents>;
  insight: string;
}

export interface RatingImprovementsResponse {
  demoId: string;
  steamId: string;
  name: string;
  currentRating: number;
  currentLabel: string;
  targetRating: number;
  targetLabel: string;
  ratingGap: number;
  alreadyAchieved: boolean;
  improvements: Array<{
    component: string;
    currentValue: number;
    targetValue: number;
    improvementNeeded: number;
    feasibility: "easy" | "moderate" | "hard";
  }>;
  recommendations: string[];
}

export interface DemoLeaderboardResponse {
  demoId: string;
  leaderboard: Array<{
    rank: number;
    steamId: string;
    name: string;
    team: number;
    rating: number;
    ratingLabel: string;
    kast: number;
    adr: number;
    kd: number;
    impact: number;
    highlights: string[];
  }>;
  mvp: {
    steamId: string;
    name: string;
    rating: number;
    ratingLabel: string;
  } | null;
  highlights: {
    highestKAST: { steamId: string; name: string; value: number } | null;
    highestADR: { steamId: string; name: string; value: number } | null;
    highestImpact: { steamId: string; name: string; value: number } | null;
    bestClutcher: { steamId: string; name: string; value: number } | null;
  };
}

// Analysis endpoints
export const analysisApi = {
  getOverview: (demoId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/overview`),

  getOpeningDuels: (demoId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/opening-duels`),

  getClutches: (demoId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/clutches`),

  getTrades: (demoId: string) => fetchApi(`/v1/analysis/demo/${demoId}/trades`),

  getEconomy: (demoId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/economy`),

  getUtility: (demoId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/utility`),

  getHeatmaps: (demoId: string, type: string, team?: "T" | "CT") => {
    const searchParams = new URLSearchParams({ type });
    if (team) searchParams.set("team", team);

    return fetchApi(`/v1/analysis/demo/${demoId}/heatmaps?${searchParams}`);
  },

  getCoachingInsights: (demoId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/coaching-insights`),
};

// ============================================================================
// User Types
// ============================================================================

export type PreferredRole =
  | "PLAYER"
  | "COACH"
  | "SCOUT"
  | "ANALYST"
  | "CREATOR";

export type ProfileVisibility = "PUBLIC" | "FRIENDS" | "PRIVATE";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  steamId: string | null;
  faceitId: string | null;
  avatar: string | null;
  createdAt: string;
}

export interface UserPreferences {
  preferredRole: PreferredRole;
  dashboardLayout: Record<string, unknown> | null;
  favoriteMetrics: string[];
  defaultTimeRange: string;
  emailNotifications: boolean;
  weeklyDigest: boolean;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;
  faceitAutoImport: boolean;
  faceitImportInterval: number;
  theme: string;
  compactMode: boolean;
  showAdvancedStats: boolean;
  profileVisibility: ProfileVisibility;
  shareStats: boolean;
}

export interface UpdatePreferencesDto {
  preferredRole?: PreferredRole;
  dashboardLayout?: Record<string, unknown>;
  favoriteMetrics?: string[];
  defaultTimeRange?: string;
  emailNotifications?: boolean;
  weeklyDigest?: boolean;
  faceitAutoImport?: boolean;
  faceitImportInterval?: number;
  theme?: string;
  compactMode?: boolean;
  showAdvancedStats?: boolean;
  profileVisibility?: ProfileVisibility;
  shareStats?: boolean;
}

export interface DashboardData {
  role: PreferredRole;
  generatedAt: string;
  data: PlayerDashboardData | CoachDashboardData | ScoutDashboardData;
}

export interface PlayerDashboardData {
  rating: {
    current: number;
    trend: number;
    label: string;
  };
  recentMatches: number;
  strengths: string[];
  weaknesses: string[];
  nextStep: {
    title: string;
    description: string;
    actionUrl: string;
  };
}

export interface CoachDashboardData {
  teamHealth: {
    overallRating: number;
    trend: number;
    playerCount: number;
  };
  playerTiles: Array<{
    steamId: string;
    name: string;
    avatar: string | null;
    rating: number;
    trend: number;
  }>;
  alerts: Array<{
    type: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
}

export interface ScoutDashboardData {
  recentOpponents: Array<{
    teamName: string;
    mapPool: string[];
    lastPlayed: string;
    winRate: number;
  }>;
  mapMeta: Record<
    string,
    {
      pickRate: number;
      avgScore: string;
    }
  >;
  watchlist: Array<{
    steamId: string;
    name: string;
    team: string;
    rating: number;
  }>;
}

// User endpoints
export const userApi = {
  // Get current user profile
  getProfile: (): Promise<UserProfile> => fetchApi<UserProfile>("/v1/user/me"),

  // Get user preferences
  getPreferences: (): Promise<UserPreferences> =>
    fetchApi<UserPreferences>("/v1/user/me/preferences"),

  // Update user preferences
  updatePreferences: (data: UpdatePreferencesDto): Promise<UserPreferences> =>
    fetchApi<UserPreferences>("/v1/user/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Get dashboard for specific role
  getDashboard: (
    role: PreferredRole,
    params?: { timeRange?: string },
  ): Promise<DashboardData> => {
    const searchParams = new URLSearchParams();
    if (params?.timeRange) searchParams.set("timeRange", params.timeRange);

    const query = searchParams.toString();
    return fetchApi<DashboardData>(
      `/v1/user/me/dashboard/${role}${query ? `?${query}` : ""}`,
    );
  },

  // Get dashboard for user's preferred role
  getPreferredDashboard: (params?: {
    timeRange?: string;
  }): Promise<DashboardData> => {
    const searchParams = new URLSearchParams();
    if (params?.timeRange) searchParams.set("timeRange", params.timeRange);

    const query = searchParams.toString();
    return fetchApi<DashboardData>(
      `/v1/user/me/dashboard${query ? `?${query}` : ""}`,
    );
  },

  // Update onboarding progress
  updateOnboarding: (
    step: number,
    completed: boolean,
  ): Promise<{ step: number; completed: boolean }> =>
    fetchApi<{ step: number; completed: boolean }>("/v1/user/me/onboarding", {
      method: "POST",
      body: JSON.stringify({ step, completed }),
    }),

  // Mark welcome as seen
  markWelcomeSeen: (): Promise<{ success: boolean }> =>
    fetchApi<{ success: boolean }>("/v1/user/me/welcome-seen", {
      method: "POST",
    }),

  // Mark tour as completed
  markTourCompleted: (): Promise<{ success: boolean }> =>
    fetchApi<{ success: boolean }>("/v1/user/me/tour-completed", {
      method: "POST",
    }),
};

// Rating endpoints
export const ratingsApi = {
  // Get all player ratings for a demo
  getDemoRatings: (demoId: string): Promise<DemoRatingsResponse> =>
    fetchApi<DemoRatingsResponse>(`/v1/analysis/demo/${demoId}/ratings`),

  // Get rating for a specific player in a demo
  getPlayerRating: (demoId: string, steamId: string) =>
    fetchApi(`/v1/analysis/demo/${demoId}/player/${steamId}/rating`),

  // Get rating history for a player
  getRatingHistory: (
    steamId: string,
    params?: { limit?: number; map?: string },
  ): Promise<RatingHistoryResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.map) searchParams.set("map", params.map);

    return fetchApi<RatingHistoryResponse>(
      `/v1/analysis/player/${steamId}/rating/history?${searchParams}`,
    );
  },

  // Simulate rating with modified stats
  simulateRating: (
    demoId: string,
    steamId: string,
    modifications: Partial<RatingComponents>,
  ): Promise<RatingSimulationResponse> =>
    fetchApi<RatingSimulationResponse>(
      `/v1/analysis/demo/${demoId}/player/${steamId}/rating/simulate`,
      {
        method: "POST",
        body: JSON.stringify(modifications),
      },
    ),

  // Get improvement suggestions
  getImprovements: (
    demoId: string,
    steamId: string,
    targetRating?: number,
  ): Promise<RatingImprovementsResponse> => {
    const searchParams = new URLSearchParams();
    if (targetRating) searchParams.set("target", targetRating.toString());

    return fetchApi<RatingImprovementsResponse>(
      `/v1/analysis/demo/${demoId}/player/${steamId}/rating/improvements?${searchParams}`,
    );
  },

  // Get demo leaderboard
  getLeaderboard: (demoId: string): Promise<DemoLeaderboardResponse> =>
    fetchApi<DemoLeaderboardResponse>(
      `/v1/analysis/demo/${demoId}/ratings/leaderboard`,
    ),
};
