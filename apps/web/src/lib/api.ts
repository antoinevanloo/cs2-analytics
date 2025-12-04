/**
 * API client for communicating with the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
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

    const response = await fetch(`${API_URL}/v1/demos/upload`, {
      method: "POST",
      body: formData,
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
};

// Player endpoints
export const playersApi = {
  get: (steamId: string) => fetchApi(`/v1/players/${steamId}`),

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
