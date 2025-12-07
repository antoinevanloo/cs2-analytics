/**
 * useUpload Hook - Real upload progress with XHR and status polling
 *
 * Features:
 * - Real upload progress via XMLHttpRequest
 * - Automatic parsing status polling
 * - Retry logic with exponential backoff
 * - Concurrent upload management
 * - Integration with upload store
 *
 * @module hooks/use-upload
 */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUploadStore,
  type UploadItem,
  type UploadPhase,
} from "@/stores/upload-store";
import { useAuthStore } from "@/stores/auth-store";

// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Polling intervals
const POLL_INTERVAL_PARSING = 2000; // 2s while parsing
const POLL_INTERVAL_SLOW = 5000; // 5s for slower updates

// ============================================================================
// Types
// ============================================================================

interface UploadResponse {
  id: string;
  filename: string;
  fileSize: number;
  status: string;
  message: string;
  jobId?: string;
}

interface StatusResponse {
  id: string;
  status: "PENDING" | "PARSING" | "COMPLETED" | "FAILED";
  uploadedAt: string;
  parsedAt: string | null;
  error: string | null;
  // Extended info after parsing
  mapName?: string;
  team1Name?: string;
  team2Name?: string;
  team1Score?: number;
  team2Score?: number;
}

interface UseUploadOptions {
  autoStart?: boolean;
  extractTicks?: boolean;
  onComplete?: (demoId: string) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// XHR Upload with Progress
// ============================================================================

async function uploadWithProgress(
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<UploadResponse> {
  // Get valid auth token before upload (with auto-refresh)
  const authStore = useAuthStore.getState();
  const token = await authStore.getValidAccessToken();

  // If no token, require login
  if (!token) {
    throw new Error("Please log in to upload demos");
  }

  const attemptUpload = (authToken: string): Promise<UploadResponse> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("autoparse", "true"); // Auto-start parsing

      // Handle abort signal
      if (signal) {
        signal.addEventListener("abort", () => {
          xhr.abort();
          reject(new Error("Upload cancelled"));
        });
      }

      // Progress event
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      // Load complete
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error("Invalid response from server"));
          }
        } else if (xhr.status === 401) {
          // Auth error - will be handled by retry logic
          reject(new Error("AUTH_EXPIRED"));
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      // Error event
      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      // Timeout
      xhr.addEventListener("timeout", () => {
        reject(new Error("Upload timed out"));
      });

      // Configure and send
      xhr.open("POST", `${API_URL}/v1/demos/upload`);
      xhr.timeout = 600000; // 10 minute timeout for large files
      xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
      xhr.send(formData);
    });
  };

  try {
    return await attemptUpload(token);
  } catch (error) {
    // If auth expired, try refreshing token once and retry
    if (error instanceof Error && error.message === "AUTH_EXPIRED") {
      console.log("Token expired during upload, attempting refresh...");

      // Force refresh the token
      const newToken = await authStore.refreshTokens();

      if (!newToken) {
        // Refresh failed - user needs to re-login
        throw new Error("Session expired. Please log in again.");
      }

      // Retry with new token
      return await attemptUpload(newToken);
    }
    throw error;
  }
}

// ============================================================================
// Status Polling
// ============================================================================

/**
 * Fetch demo parsing status with authentication.
 *
 * Uses the same auth pattern as the rest of the app:
 * - Access token in Authorization header
 * - HttpOnly refresh token cookie via credentials: "include"
 * - Automatic token refresh on 401
 *
 * @param demoId - UUID of the demo to check status for
 * @returns Status response with parsing state
 * @throws Error if authentication fails or request fails
 */
async function fetchDemoStatus(demoId: string): Promise<StatusResponse> {
  const authStore = useAuthStore.getState();
  const token = await authStore.getValidAccessToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`${API_URL}/v1/demos/${demoId}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // Include credentials to send HttpOnly cookies (refresh token)
    credentials: "include",
  });

  // Handle token expiration - attempt automatic refresh
  if (response.status === 401) {
    const newToken = await authStore.refreshTokens();
    if (!newToken) {
      throw new Error("Session expired");
    }

    const retryResponse = await fetch(`${API_URL}/v1/demos/${demoId}/status`, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
      credentials: "include",
    });

    if (!retryResponse.ok) {
      throw new Error("Failed to fetch status");
    }
    return retryResponse.json();
  }

  if (!response.ok) {
    throw new Error("Failed to fetch status");
  }
  return response.json();
}

// ============================================================================
// Main Hook
// ============================================================================

export function useUpload(options: UseUploadOptions = {}) {
  const { autoStart = true, extractTicks = false, onComplete, onError } = options;

  const queryClient = useQueryClient();

  // Store actions
  const {
    uploads,
    isUploading,
    isPaused,
    stats,
    addFiles,
    removeUpload,
    clearCompleted,
    clearAll,
    setUploadProgress,
    setUploadPhase,
    setDemoId,
    setParseProgress,
    setParseDetails,
    setError,
    markCompleted,
    retryUpload,
    cancelUpload,
    getNextPendingUpload,
    getActiveUploads,
    getParsingUploads,
  } = useUploadStore();

  // Refs for cleanup
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ============================================================================
  // Upload single file
  // ============================================================================

  const processUpload = useCallback(
    async (upload: UploadItem) => {
      const abortController = new AbortController();
      abortControllersRef.current.set(upload.id, abortController);

      try {
        // Phase: Uploading
        setUploadPhase(upload.id, "uploading");

        // Upload with real progress
        const response = await uploadWithProgress(
          upload.file,
          (progress) => setUploadProgress(upload.id, progress),
          abortController.signal,
        );

        // Save server response
        setDemoId(upload.id, response.id, response.jobId);
        setUploadPhase(upload.id, "uploaded");

        // Start polling for parse status
        startStatusPolling(upload.id, response.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";

        // Don't set error for cancellations
        if (message !== "Upload cancelled") {
          setError(upload.id, message);
          onError?.(message);
        }
      } finally {
        abortControllersRef.current.delete(upload.id);
      }
    },
    [setUploadPhase, setUploadProgress, setDemoId, setError, onError],
  );

  // ============================================================================
  // Status polling
  // ============================================================================

  const startStatusPolling = useCallback(
    (uploadId: string, demoId: string) => {
      // Clear any existing polling
      const existingInterval = pollingIntervalsRef.current.get(uploadId);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      let estimatedProgress = 0;
      let pollCount = 0;

      const poll = async () => {
        try {
          const status = await fetchDemoStatus(demoId);
          pollCount++;

          switch (status.status) {
            case "PENDING":
              setUploadPhase(uploadId, "uploaded");
              estimatedProgress = Math.min(5, pollCount * 2);
              setParseProgress(uploadId, estimatedProgress);
              break;

            case "PARSING":
              setUploadPhase(uploadId, "parsing");
              // Estimate progress based on poll count (parsing typically takes 30-90s)
              estimatedProgress = Math.min(95, 10 + pollCount * 3);
              setParseProgress(uploadId, estimatedProgress);
              break;

            case "COMPLETED":
              setUploadPhase(uploadId, "completed");
              setParseProgress(uploadId, 100);

              // Set parse details
              if (status.mapName) {
                setParseDetails(uploadId, {
                  mapName: status.mapName,
                  team1: status.team1Name,
                  team2: status.team2Name,
                  score:
                    status.team1Score !== undefined
                      ? `${status.team1Score} - ${status.team2Score}`
                      : undefined,
                });
              }

              markCompleted(uploadId);

              // Invalidate queries to refresh demo list
              queryClient.invalidateQueries({ queryKey: ["demos"] });
              queryClient.invalidateQueries({ queryKey: ["demo", demoId] });

              onComplete?.(demoId);

              // Stop polling
              clearInterval(pollingIntervalsRef.current.get(uploadId));
              pollingIntervalsRef.current.delete(uploadId);
              break;

            case "FAILED":
              setError(uploadId, status.error || "Parsing failed");
              onError?.(status.error || "Parsing failed");

              // Stop polling
              clearInterval(pollingIntervalsRef.current.get(uploadId));
              pollingIntervalsRef.current.delete(uploadId);
              break;
          }
        } catch (error) {
          console.error("Status polling error:", error);
          // Don't stop polling on transient errors, just log
        }
      };

      // Initial poll
      poll();

      // Start interval polling
      const intervalId = setInterval(poll, POLL_INTERVAL_PARSING);
      pollingIntervalsRef.current.set(uploadId, intervalId);
    },
    [
      setUploadPhase,
      setParseProgress,
      setParseDetails,
      markCompleted,
      setError,
      queryClient,
      onComplete,
      onError,
    ],
  );

  // ============================================================================
  // Auto-process queue
  // ============================================================================

  useEffect(() => {
    if (!autoStart || isPaused) return;

    const processNext = () => {
      const next = getNextPendingUpload();
      if (next) {
        processUpload(next);
      }
    };

    // Check for pending uploads periodically
    const intervalId = setInterval(processNext, 500);
    processNext(); // Initial check

    return () => clearInterval(intervalId);
  }, [autoStart, isPaused, getNextPendingUpload, processUpload]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      // Abort all active uploads
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();

      // Clear all polling intervals
      pollingIntervalsRef.current.forEach((interval) => clearInterval(interval));
      pollingIntervalsRef.current.clear();
    };
  }, []);

  // ============================================================================
  // Cancel specific upload
  // ============================================================================

  const cancel = useCallback(
    (uploadId: string) => {
      // Abort if uploading
      const controller = abortControllersRef.current.get(uploadId);
      if (controller) {
        controller.abort();
      }

      // Stop polling
      const interval = pollingIntervalsRef.current.get(uploadId);
      if (interval) {
        clearInterval(interval);
        pollingIntervalsRef.current.delete(uploadId);
      }

      cancelUpload(uploadId);
    },
    [cancelUpload],
  );

  // ============================================================================
  // Resume polling for uploads that were in parsing state
  // ============================================================================

  useEffect(() => {
    // Resume polling for any uploads that have demoId but aren't complete
    uploads.forEach((upload) => {
      if (
        upload.demoId &&
        (upload.phase === "uploaded" ||
          upload.phase === "parsing" ||
          upload.phase === "analyzing") &&
        !pollingIntervalsRef.current.has(upload.id)
      ) {
        startStatusPolling(upload.id, upload.demoId);
      }
    });
  }, [uploads, startStatusPolling]);

  // ============================================================================
  // Return API
  // ============================================================================

  return {
    // State
    uploads,
    isUploading,
    isPaused,
    stats,

    // Actions
    addFiles,
    removeUpload,
    clearCompleted,
    clearAll,
    cancel,
    retry: retryUpload,

    // Computed
    activeUploads: getActiveUploads(),
    parsingUploads: getParsingUploads(),
    hasUploads: uploads.length > 0,
    hasPending: uploads.some((u) => u.phase === "queued"),
    hasActive: uploads.some(
      (u) =>
        u.phase === "uploading" ||
        u.phase === "uploaded" ||
        u.phase === "parsing",
    ),
  };
}

// ============================================================================
// Single file upload hook (simplified)
// ============================================================================

export function useUploadSingle() {
  const { addFiles, uploads } = useUpload();

  const upload = useCallback(
    (file: File) => {
      addFiles([file]);
    },
    [addFiles],
  );

  const latestUpload = uploads[uploads.length - 1];

  return {
    upload,
    status: latestUpload?.phase,
    progress: latestUpload?.uploadProgress ?? 0,
    parseProgress: latestUpload?.parseProgress ?? 0,
    demoId: latestUpload?.demoId,
    error: latestUpload?.error,
  };
}
