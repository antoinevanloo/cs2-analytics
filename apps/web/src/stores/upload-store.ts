/**
 * Upload Store - Global state management for demo uploads
 *
 * Manages upload queue, progress tracking, and parsing status.
 * Provides resilient, concurrent upload handling with real-time updates.
 *
 * @module stores/upload-store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type UploadPhase =
  | "queued" // File added, waiting to upload
  | "uploading" // Currently uploading to server
  | "uploaded" // Upload complete, waiting for parsing
  | "parsing" // Parser is processing
  | "analyzing" // Post-parse analysis
  | "completed" // All done
  | "failed" // Error occurred
  | "cancelled"; // User cancelled

export interface UploadItem {
  id: string; // Unique client-side ID
  file: File;
  filename: string;
  fileSize: number;
  phase: UploadPhase;

  // Progress tracking
  uploadProgress: number; // 0-100 for upload phase
  parseProgress: number; // 0-100 for parsing phase (estimated)

  // Server response
  demoId?: string; // Server-assigned demo ID after upload
  jobId?: string; // BullMQ job ID

  // Timing
  startedAt?: number;
  completedAt?: number;

  // Error handling
  error?: string;
  retryCount: number;
  maxRetries: number;

  // Parsing details
  mapName?: string;
  team1?: string;
  team2?: string;
  score?: string;
}

export interface UploadStats {
  totalUploads: number;
  completedUploads: number;
  failedUploads: number;
  totalBytes: number;
  uploadedBytes: number;
}

interface UploadState {
  // Upload queue
  uploads: UploadItem[];
  activeUploadId: string | null;
  maxConcurrentUploads: number;

  // Global state
  isUploading: boolean;
  isPaused: boolean;

  // Stats
  stats: UploadStats;

  // Actions - Queue management
  addFiles: (files: File[]) => void;
  removeUpload: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;

  // Actions - Upload progress
  setUploadProgress: (id: string, progress: number) => void;
  setUploadPhase: (id: string, phase: UploadPhase) => void;
  setDemoId: (id: string, demoId: string, jobId?: string) => void;
  setParseProgress: (id: string, progress: number) => void;
  setParseDetails: (
    id: string,
    details: { mapName?: string; team1?: string; team2?: string; score?: string },
  ) => void;
  setError: (id: string, error: string) => void;
  markCompleted: (id: string) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;

  // Actions - Active upload management
  setActiveUpload: (id: string | null) => void;
  getNextPendingUpload: () => UploadItem | undefined;

  // Computed
  getUploadById: (id: string) => UploadItem | undefined;
  getActiveUploads: () => UploadItem[];
  getPendingUploads: () => UploadItem[];
  getParsingUploads: () => UploadItem[];
}

// ============================================================================
// Helper functions
// ============================================================================

function generateId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateStats(uploads: UploadItem[]): UploadStats {
  return {
    totalUploads: uploads.length,
    completedUploads: uploads.filter((u) => u.phase === "completed").length,
    failedUploads: uploads.filter((u) => u.phase === "failed").length,
    totalBytes: uploads.reduce((acc, u) => acc + u.fileSize, 0),
    uploadedBytes: uploads.reduce((acc, u) => {
      if (u.phase === "completed" || u.phase === "parsing" || u.phase === "analyzing") {
        return acc + u.fileSize;
      }
      if (u.phase === "uploading") {
        return acc + (u.fileSize * u.uploadProgress) / 100;
      }
      return acc;
    }, 0),
  };
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useUploadStore = create<UploadState>()(
  persist(
    (set, get) => ({
      // Initial state
      uploads: [],
      activeUploadId: null,
      maxConcurrentUploads: 2, // Allow 2 concurrent uploads
      isUploading: false,
      isPaused: false,
      stats: {
        totalUploads: 0,
        completedUploads: 0,
        failedUploads: 0,
        totalBytes: 0,
        uploadedBytes: 0,
      },

      // Add files to queue
      addFiles: (files) => {
        const validFiles = files.filter(
          (f) => f.name.toLowerCase().endsWith(".dem") && f.size > 0,
        );

        if (validFiles.length === 0) return;

        const newUploads: UploadItem[] = validFiles.map((file) => ({
          id: generateId(),
          file,
          filename: file.name,
          fileSize: file.size,
          phase: "queued",
          uploadProgress: 0,
          parseProgress: 0,
          retryCount: 0,
          maxRetries: 3,
        }));

        set((state) => {
          const uploads = [...state.uploads, ...newUploads];
          return {
            uploads,
            stats: calculateStats(uploads),
            isUploading: true,
          };
        });
      },

      // Remove upload from queue
      removeUpload: (id) =>
        set((state) => {
          const uploads = state.uploads.filter((u) => u.id !== id);
          return {
            uploads,
            stats: calculateStats(uploads),
            activeUploadId:
              state.activeUploadId === id ? null : state.activeUploadId,
          };
        }),

      // Clear completed uploads
      clearCompleted: () =>
        set((state) => {
          const uploads = state.uploads.filter(
            (u) => u.phase !== "completed" && u.phase !== "failed",
          );
          return {
            uploads,
            stats: calculateStats(uploads),
          };
        }),

      // Clear all uploads
      clearAll: () =>
        set({
          uploads: [],
          activeUploadId: null,
          isUploading: false,
          stats: {
            totalUploads: 0,
            completedUploads: 0,
            failedUploads: 0,
            totalBytes: 0,
            uploadedBytes: 0,
          },
        }),

      // Pause all uploads
      pauseAll: () => set({ isPaused: true }),

      // Resume uploads
      resumeAll: () => set({ isPaused: false }),

      // Set upload progress
      setUploadProgress: (id, progress) =>
        set((state) => {
          const uploads = state.uploads.map((u) =>
            u.id === id ? { ...u, uploadProgress: Math.min(100, progress) } : u,
          );
          return { uploads, stats: calculateStats(uploads) };
        }),

      // Set upload phase
      setUploadPhase: (id, phase) =>
        set((state) => {
          const uploads = state.uploads.map((u) =>
            u.id === id
              ? {
                  ...u,
                  phase,
                  startedAt:
                    phase === "uploading" && !u.startedAt ? Date.now() : u.startedAt,
                  completedAt: phase === "completed" ? Date.now() : u.completedAt,
                }
              : u,
          );
          const isUploading = uploads.some(
            (u) =>
              u.phase === "uploading" ||
              u.phase === "parsing" ||
              u.phase === "queued",
          );
          return { uploads, stats: calculateStats(uploads), isUploading };
        }),

      // Set demo ID after upload
      setDemoId: (id, demoId, jobId) =>
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, demoId, jobId } : u,
          ),
        })),

      // Set parse progress
      setParseProgress: (id, progress) =>
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, parseProgress: Math.min(100, progress) } : u,
          ),
        })),

      // Set parse details (map, teams, score)
      setParseDetails: (id, details) =>
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, ...details } : u,
          ),
        })),

      // Set error
      setError: (id, error) =>
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, error, phase: "failed" as UploadPhase } : u,
          ),
        })),

      // Mark as completed
      markCompleted: (id) =>
        set((state) => {
          const uploads = state.uploads.map((u) =>
            u.id === id
              ? {
                  ...u,
                  phase: "completed" as UploadPhase,
                  uploadProgress: 100,
                  parseProgress: 100,
                  completedAt: Date.now(),
                }
              : u,
          );
          const isUploading = uploads.some(
            (u) =>
              u.phase === "uploading" ||
              u.phase === "parsing" ||
              u.phase === "queued",
          );
          return { uploads, stats: calculateStats(uploads), isUploading };
        }),

      // Retry failed upload
      retryUpload: (id) =>
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id && u.retryCount < u.maxRetries
              ? {
                  ...u,
                  phase: "queued" as UploadPhase,
                  error: undefined,
                  retryCount: u.retryCount + 1,
                  uploadProgress: 0,
                  parseProgress: 0,
                }
              : u,
          ),
          isUploading: true,
        })),

      // Cancel upload
      cancelUpload: (id) =>
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id
              ? { ...u, phase: "cancelled" as UploadPhase }
              : u,
          ),
        })),

      // Set active upload
      setActiveUpload: (id) => set({ activeUploadId: id }),

      // Get next pending upload
      getNextPendingUpload: () => {
        const state = get();
        if (state.isPaused) return undefined;

        const activeCount = state.uploads.filter(
          (u) => u.phase === "uploading",
        ).length;

        if (activeCount >= state.maxConcurrentUploads) return undefined;

        return state.uploads.find((u) => u.phase === "queued");
      },

      // Get upload by ID
      getUploadById: (id) => get().uploads.find((u) => u.id === id),

      // Get active uploads (uploading or parsing)
      getActiveUploads: () =>
        get().uploads.filter(
          (u) =>
            u.phase === "uploading" ||
            u.phase === "uploaded" ||
            u.phase === "parsing" ||
            u.phase === "analyzing",
        ),

      // Get pending uploads
      getPendingUploads: () =>
        get().uploads.filter((u) => u.phase === "queued"),

      // Get parsing uploads
      getParsingUploads: () =>
        get().uploads.filter(
          (u) => u.phase === "parsing" || u.phase === "analyzing",
        ),
    }),
    {
      name: "cs2-upload-storage",
      storage: createJSONStorage(() => sessionStorage), // Use session storage
      // Don't persist File objects - only metadata
      partialize: (state) => ({
        // We only persist minimal state for UI continuity
        stats: state.stats,
      }),
    },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectUploads = (state: UploadState) => state.uploads;
export const selectIsUploading = (state: UploadState) => state.isUploading;
export const selectStats = (state: UploadState) => state.stats;
export const selectActiveUploads = (state: UploadState) =>
  state.uploads.filter(
    (u) =>
      u.phase === "uploading" ||
      u.phase === "uploaded" ||
      u.phase === "parsing" ||
      u.phase === "analyzing",
  );
