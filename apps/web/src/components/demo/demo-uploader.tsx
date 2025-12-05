"use client";

/**
 * DemoUploader - Gaming-style upload component
 *
 * Features:
 * - Drag & drop with visual feedback
 * - Real-time upload progress
 * - Parse status tracking
 * - Multi-file support with queue
 * - Retry failed uploads
 * - Gaming-inspired UI
 *
 * @module components/demo/demo-uploader
 */

import { useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUpload } from "@/hooks/use-upload";
import { type UploadItem, type UploadPhase } from "@/stores/upload-store";
import { cn, formatDuration } from "@/lib/utils";
import {
  Upload,
  FileVideo,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  Clock,
  Target,
  Map,
  RotateCw,
  Trash2,
  Play,
  Pause,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface DemoUploaderProps {
  onUploadComplete?: () => void;
  onCancel?: () => void;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Phase configuration
// ============================================================================

const phaseConfig: Record<
  UploadPhase,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ComponentType<{ className?: string }>;
    animate?: boolean;
  }
> = {
  queued: {
    label: "Queued",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: Clock,
  },
  uploading: {
    label: "Uploading",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: Upload,
    animate: true,
  },
  uploaded: {
    label: "Uploaded",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    icon: CheckCircle,
  },
  parsing: {
    label: "Analyzing",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    icon: Zap,
    animate: true,
  },
  analyzing: {
    label: "Processing",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    icon: Target,
    animate: true,
  },
  completed: {
    label: "Complete",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle,
  },
  failed: {
    label: "Failed",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: X,
  },
};

// ============================================================================
// Utility functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getOverallProgress(upload: UploadItem): number {
  switch (upload.phase) {
    case "queued":
      return 0;
    case "uploading":
      return upload.uploadProgress * 0.4; // 0-40%
    case "uploaded":
      return 40;
    case "parsing":
    case "analyzing":
      return 40 + upload.parseProgress * 0.6; // 40-100%
    case "completed":
      return 100;
    default:
      return 0;
  }
}

// ============================================================================
// UploadItemCard Component
// ============================================================================

interface UploadItemCardProps {
  upload: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

function UploadItemCard({ upload, onCancel, onRetry, onRemove }: UploadItemCardProps) {
  const config = phaseConfig[upload.phase];
  const Icon = config.icon;
  const overallProgress = getOverallProgress(upload);
  const isActive = ["uploading", "uploaded", "parsing", "analyzing"].includes(upload.phase);
  const canRetry = upload.phase === "failed" && upload.retryCount < upload.maxRetries;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border transition-all duration-300",
        isActive && "border-primary/50 shadow-lg shadow-primary/10",
        upload.phase === "completed" && "border-green-500/50",
        upload.phase === "failed" && "border-red-500/50",
      )}
    >
      {/* Progress background */}
      {isActive && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 transition-all duration-500"
          style={{ width: `${overallProgress}%` }}
        />
      )}

      <div className="relative p-4">
        <div className="flex items-start gap-4">
          {/* File icon with status */}
          <div
            className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-lg transition-all",
              config.bgColor,
            )}
          >
            <FileVideo className={cn("h-6 w-6", config.color)} />
            {config.animate && (
              <div className="absolute inset-0 rounded-lg animate-pulse bg-current opacity-20" />
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{upload.filename}</p>
              <span
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                  config.bgColor,
                  config.color,
                )}
              >
                <Icon className={cn("h-3 w-3", config.animate && "animate-spin")} />
                {config.label}
              </span>
            </div>

            <p className="text-sm text-muted-foreground mt-0.5">
              {formatFileSize(upload.fileSize)}
              {upload.mapName && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Map className="h-3 w-3" />
                  {upload.mapName}
                </span>
              )}
              {upload.score && (
                <span className="ml-2 text-primary font-medium">{upload.score}</span>
              )}
            </p>

            {/* Progress section */}
            {isActive && (
              <div className="mt-3 space-y-1.5">
                {/* Upload progress */}
                {(upload.phase === "uploading" || upload.uploadProgress < 100) && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Upload</span>
                      <span className={config.color}>{upload.uploadProgress}%</span>
                    </div>
                    <Progress
                      value={upload.uploadProgress}
                      className="h-1.5"
                    />
                  </div>
                )}

                {/* Parse progress */}
                {(upload.phase === "parsing" ||
                  upload.phase === "analyzing" ||
                  upload.parseProgress > 0) && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Analysis</span>
                      <span className={config.color}>
                        {upload.parseProgress < 100 ? `~${upload.parseProgress}%` : "100%"}
                      </span>
                    </div>
                    <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                          "bg-gradient-to-r from-yellow-500 to-green-500",
                        )}
                        style={{ width: `${upload.parseProgress}%` }}
                      />
                      {upload.phase === "parsing" && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                      )}
                    </div>
                  </div>
                )}

                {/* Combined progress */}
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-dashed">
                  <span className="text-muted-foreground">Overall</span>
                  <span className="font-medium text-primary">{Math.round(overallProgress)}%</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {upload.error && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded bg-red-500/10 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{upload.error}</span>
              </div>
            )}

            {/* Completed info */}
            {upload.phase === "completed" && (
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                {upload.team1 && upload.team2 && (
                  <span>
                    {upload.team1} vs {upload.team2}
                  </span>
                )}
                {upload.completedAt && upload.startedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(Math.round((upload.completedAt - upload.startedAt) / 1000))}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {canRetry && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRetry(upload.id)}
                className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {upload.phase === "queued" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(upload.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {isActive && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCancel(upload.id)}
                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {(upload.phase === "completed" ||
              upload.phase === "failed" ||
              upload.phase === "cancelled") && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(upload.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DemoUploader({
  onUploadComplete,
  onCancel,
  compact = false,
  className,
}: DemoUploaderProps) {
  const {
    uploads,
    isUploading,
    stats,
    addFiles,
    removeUpload,
    clearCompleted,
    clearAll,
    cancel,
    retry,
    hasUploads,
  } = useUpload({
    onComplete: () => {
      onUploadComplete?.();
    },
  });

  // Dropzone configuration
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      addFiles(acceptedFiles);
    },
    [addFiles],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "application/octet-stream": [".dem"],
    },
    multiple: true,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  // Computed values
  const completedCount = uploads.filter((u) => u.phase === "completed").length;
  const failedCount = uploads.filter((u) => u.phase === "failed").length;
  const activeCount = uploads.filter(
    (u) =>
      u.phase === "uploading" ||
      u.phase === "uploaded" ||
      u.phase === "parsing" ||
      u.phase === "analyzing",
  ).length;
  const queuedCount = uploads.filter((u) => u.phase === "queued").length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer",
          compact ? "p-6" : "p-8",
          isDragActive && !isDragReject && "border-primary bg-primary/5 scale-[1.02]",
          isDragReject && "border-red-500 bg-red-500/5",
          !isDragActive && "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <input {...getInputProps()} />

        {/* Animated background */}
        {isDragActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/10 animate-pulse" />
        )}

        <div className="relative text-center">
          <div
            className={cn(
              "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all",
              isDragActive ? "bg-primary/20 scale-110" : "bg-muted",
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 transition-all",
                isDragActive ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>

          {isDragActive ? (
            <div>
              <p className="text-lg font-semibold text-primary">Drop demos here</p>
              <p className="text-sm text-muted-foreground">Release to start upload</p>
            </div>
          ) : isDragReject ? (
            <div>
              <p className="text-lg font-semibold text-red-500">Invalid file type</p>
              <p className="text-sm text-muted-foreground">Only .dem files are accepted</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold">Drag & drop demo files</p>
              <p className="text-sm text-muted-foreground">
                or click to browse (.dem files, max 500MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload queue */}
      {hasUploads && (
        <>
          {/* Queue header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Upload Queue</h3>
              <div className="flex items-center gap-2 text-sm">
                {activeCount > 0 && (
                  <span className="flex items-center gap-1 text-blue-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {activeCount} active
                  </span>
                )}
                {queuedCount > 0 && (
                  <span className="text-muted-foreground">{queuedCount} queued</span>
                )}
                {completedCount > 0 && (
                  <span className="text-green-500">{completedCount} completed</span>
                )}
                {failedCount > 0 && (
                  <span className="text-red-500">{failedCount} failed</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCompleted}>
                  Clear completed
                </Button>
              )}
            </div>
          </div>

          {/* Upload items */}
          <div className="space-y-2">
            {uploads.map((upload) => (
              <UploadItemCard
                key={upload.id}
                upload={upload}
                onCancel={cancel}
                onRetry={retry}
                onRemove={removeUpload}
              />
            ))}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {stats.totalUploads} file{stats.totalUploads !== 1 ? "s" : ""} &bull;{" "}
              {formatFileSize(stats.totalBytes)}
            </div>
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={activeCount > 0}>
                  {activeCount > 0 ? "Processing..." : "Close"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* CSS for shimmer animation */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}

export default DemoUploader;
