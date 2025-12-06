/**
 * useReplay Hook - Fetch and manage replay data
 *
 * Features:
 * - Fetches round replay data from API with authentication
 * - Supports NDJSON streaming for large replays
 * - Manages loading state and error handling
 * - Integrates with replay store
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReplayStore,
  type TickFrame,
  type ReplayEvent,
  type MapConfig,
  type RoundMetadata,
} from "@/stores/replay-store";
import { useAuthStore } from "@/stores/auth-store";

// API base URL - same as the main API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Get authentication headers
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getValidAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// API response types
interface RoundReplayResponse {
  demoId: string;
  roundNumber: number;
  startTick: number;
  endTick: number;
  winnerTeam: number;
  winReason: string;
  ctTeam: {
    name: string;
    players: string[];
    score: number;
  };
  tTeam: {
    name: string;
    players: string[];
    score: number;
  };
  tickRate: number;
  sampleInterval: number;
  frames: TickFrame[];
  events: ReplayEvent[];
}

interface RoundsMetadataResponse {
  roundNumber: number;
  startTick: number;
  endTick: number;
  winnerTeam: number;
  winReason: string;
  ctScore: number;
  tScore: number;
}

interface MapConfigResponse {
  mapName: string;
  posX: number;
  posY: number;
  scale: number;
  radarWidth: number;
  radarHeight: number;
  hasLowerLevel: boolean;
  lowerPosX?: number;
  lowerPosY?: number;
  lowerScale?: number;
  splitAltitude?: number;
  displayName?: string;
}

interface AvailabilityResponse {
  available: boolean;
  tickDataExists: boolean;
}

// Fetch functions with authentication
async function fetchRoundReplay(
  demoId: string,
  roundNumber: number,
  options?: { sampleInterval?: number; includeEvents?: boolean },
): Promise<RoundReplayResponse> {
  const params = new URLSearchParams();
  if (options?.sampleInterval) {
    params.set("sampleInterval", options.sampleInterval.toString());
  }
  if (options?.includeEvents !== undefined) {
    params.set("includeEvents", options.includeEvents.toString());
  }

  const url = `${API_BASE_URL}/v1/replay/${demoId}/round/${roundNumber}${params.toString() ? `?${params}` : ""}`;
  const authHeaders = await getAuthHeaders();
  const response = await fetch(url, {
    headers: authHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to fetch replay: ${response.statusText}`);
  }

  return response.json();
}

async function fetchRoundsMetadata(
  demoId: string,
): Promise<RoundsMetadataResponse[]> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/v1/replay/${demoId}/rounds`, {
    headers: authHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to fetch rounds: ${response.statusText}`);
  }

  return response.json();
}

async function fetchMapConfig(mapName: string): Promise<MapConfigResponse> {
  // Map config is public, no auth needed
  const response = await fetch(`${API_BASE_URL}/v1/replay/map/${mapName}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to fetch map config: ${response.statusText}`);
  }

  return response.json();
}

async function checkAvailability(
  demoId: string,
): Promise<AvailabilityResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/v1/replay/${demoId}/available`, {
    headers: authHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to check availability: ${response.statusText}`);
  }

  return response.json();
}

// NDJSON streaming parser
interface StreamMessage {
  type: "metadata" | "frame" | "event" | "end" | "error";
  data: unknown;
}

async function* streamRoundReplay(
  demoId: string,
  roundNumber: number,
  options?: { sampleInterval?: number; batchSize?: number },
): AsyncGenerator<StreamMessage> {
  const params = new URLSearchParams();
  if (options?.sampleInterval) {
    params.set("sampleInterval", options.sampleInterval.toString());
  }
  if (options?.batchSize) {
    params.set("batchSize", options.batchSize.toString());
  }

  const url = `${API_BASE_URL}/v1/replay/${demoId}/round/${roundNumber}/stream${params.toString() ? `?${params}` : ""}`;
  const authHeaders = await getAuthHeaders();
  const response = await fetch(url, {
    headers: authHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to stream replay: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line) as StreamMessage;
            yield message;
          } catch {
            console.warn("Failed to parse NDJSON line:", line);
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const message = JSON.parse(buffer) as StreamMessage;
        yield message;
      } catch {
        console.warn("Failed to parse final NDJSON buffer:", buffer);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Hook options
interface UseReplayOptions {
  demoId: string;
  roundNumber: number;
  mapName?: string;
  sampleInterval?: number;
  useStreaming?: boolean;
  enabled?: boolean;
}

// Main hook
export function useReplay({
  demoId,
  roundNumber,
  mapName,
  sampleInterval = 8,
  useStreaming = false,
  enabled = true,
}: UseReplayOptions) {
  const {
    setFrames,
    setEvents,
    setMapConfig,
    setRoundMetadata,
    setError,
    loadReplay,
    reset,
  } = useReplayStore();

  const [streamingProgress, setStreamingProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Check availability
  const availabilityQuery = useQuery({
    queryKey: ["replay-availability", demoId],
    queryFn: () => checkAvailability(demoId),
    enabled: enabled && !!demoId,
    staleTime: 60000, // 1 minute
  });

  // Fetch map config
  const mapConfigQuery = useQuery({
    queryKey: ["map-config", mapName],
    queryFn: () => fetchMapConfig(mapName!),
    enabled: enabled && !!mapName,
    staleTime: Infinity, // Map configs don't change
  });

  // Update map config in store when data changes
  useEffect(() => {
    if (mapConfigQuery.data) {
      setMapConfig(mapConfigQuery.data);
    }
  }, [mapConfigQuery.data, setMapConfig]);

  // Fetch round replay (non-streaming)
  const replayQuery = useQuery({
    queryKey: ["round-replay", demoId, roundNumber, sampleInterval],
    queryFn: () =>
      fetchRoundReplay(demoId, roundNumber, {
        sampleInterval,
        includeEvents: true,
      }),
    enabled:
      enabled &&
      !!demoId &&
      !!roundNumber &&
      !useStreaming &&
      availabilityQuery.data?.available === true,
    staleTime: 300000, // 5 minutes
  });

  // Update store when replay data changes
  useEffect(() => {
    if (replayQuery.data) {
      const data = replayQuery.data;
      const metadata: RoundMetadata = {
        roundNumber: data.roundNumber,
        startTick: data.startTick,
        endTick: data.endTick,
        winnerTeam: data.winnerTeam,
        winReason: data.winReason,
        ctTeam: data.ctTeam,
        tTeam: data.tTeam,
      };

      setRoundMetadata(metadata);
      setFrames(data.frames);
      setEvents(data.events);
    }
  }, [replayQuery.data, setRoundMetadata, setFrames, setEvents]);

  // Handle errors
  useEffect(() => {
    if (replayQuery.error) {
      setError(replayQuery.error.message);
    }
  }, [replayQuery.error, setError]);

  // Streaming fetch function
  const streamReplay = useCallback(async () => {
    if (!demoId || !roundNumber) return;

    setIsStreaming(true);
    setStreamingProgress(0);
    abortRef.current = new AbortController();

    const frames: TickFrame[] = [];
    const events: ReplayEvent[] = [];

    try {
      loadReplay(demoId, roundNumber);

      let frameCount = 0;
      for await (const message of streamRoundReplay(demoId, roundNumber, {
        sampleInterval,
      })) {
        if (abortRef.current?.signal.aborted) break;

        switch (message.type) {
          case "metadata":
            const metadata = message.data as RoundMetadata;
            setRoundMetadata(metadata);
            break;

          case "frame":
            frames.push(message.data as TickFrame);
            frameCount++;
            // Update progress every 100 frames
            if (frameCount % 100 === 0) {
              setStreamingProgress(frameCount);
            }
            break;

          case "event":
            events.push(message.data as ReplayEvent);
            break;

          case "end":
            // Final update
            setFrames(frames);
            setEvents(events);
            break;

          case "error":
            const errorData = message.data as { message: string };
            setError(errorData.message);
            break;
        }
      }

      if (!abortRef.current?.signal.aborted) {
        setFrames(frames);
        setEvents(events);
      }
    } catch (error) {
      if (!abortRef.current?.signal.aborted) {
        setError(error instanceof Error ? error.message : "Streaming failed");
      }
    } finally {
      setIsStreaming(false);
    }
  }, [
    demoId,
    roundNumber,
    sampleInterval,
    loadReplay,
    setFrames,
    setEvents,
    setRoundMetadata,
    setError,
  ]);

  // Cancel streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Auto-stream on mount if streaming is enabled
  useEffect(() => {
    if (
      useStreaming &&
      enabled &&
      availabilityQuery.data?.available &&
      !isStreaming
    ) {
      streamReplay();
    }
  }, [
    useStreaming,
    enabled,
    availabilityQuery.data?.available,
    streamReplay,
    isStreaming,
  ]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    // Availability
    isAvailable: availabilityQuery.data?.available ?? false,
    isCheckingAvailability: availabilityQuery.isLoading,

    // Map config
    mapConfig: mapConfigQuery.data,
    isLoadingMapConfig: mapConfigQuery.isLoading,

    // Replay data
    isLoading: useStreaming ? isStreaming : replayQuery.isLoading,
    isError: useStreaming ? false : replayQuery.isError,
    error: useStreaming ? null : replayQuery.error,

    // Streaming
    isStreaming,
    streamingProgress,
    streamReplay,
    cancelStream: () => abortRef.current?.abort(),

    // Refetch
    refetch: useStreaming ? streamReplay : replayQuery.refetch,
  };
}

// Hook to fetch all rounds for a demo
export function useRoundsMetadata(demoId: string, enabled = true) {
  return useQuery({
    queryKey: ["rounds-metadata", demoId],
    queryFn: () => fetchRoundsMetadata(demoId),
    enabled: enabled && !!demoId,
    staleTime: 300000, // 5 minutes
  });
}

// Hook to fetch all available maps (public endpoint, no auth needed)
export function useAvailableMaps() {
  return useQuery({
    queryKey: ["available-maps"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/v1/replay/maps`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `Failed to fetch maps: ${response.statusText}`);
      }
      return response.json() as Promise<MapConfigResponse[]>;
    },
    staleTime: Infinity,
  });
}
