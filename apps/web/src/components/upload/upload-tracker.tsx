/**
 * UploadTracker - Global upload progress indicator for the header
 *
 * Shows a compact view of ongoing uploads with expandable details.
 * Gaming-inspired design with animated progress indicators.
 *
 * @module components/upload/upload-tracker
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useUploadStore,
  type UploadItem,
  type UploadPhase,
} from "@/stores/upload-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  X,
  FileVideo,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Phase Configuration
// ============================================================================

const PHASE_CONFIG: Record<
  UploadPhase,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ElementType;
    animate?: boolean;
  }
> = {
  queued: {
    label: "Queued",
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
    icon: Upload,
  },
  uploading: {
    label: "Uploading",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    icon: Upload,
    animate: true,
  },
  uploaded: {
    label: "Processing",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    icon: Loader2,
    animate: true,
  },
  parsing: {
    label: "Parsing",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    icon: Loader2,
    animate: true,
  },
  analyzing: {
    label: "Analyzing",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    icon: Loader2,
    animate: true,
  },
  completed: {
    label: "Complete",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
    icon: X,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getOverallProgress(uploads: UploadItem[]): number {
  if (uploads.length === 0) return 0;

  const activeUploads = uploads.filter(
    (u) =>
      u.phase !== "completed" && u.phase !== "failed" && u.phase !== "cancelled"
  );

  if (activeUploads.length === 0) return 100;

  const totalProgress = activeUploads.reduce((acc, upload) => {
    // Weight: upload = 40%, parsing = 60%
    const uploadWeight = upload.uploadProgress * 0.4;
    const parseWeight = upload.parseProgress * 0.6;
    return acc + uploadWeight + parseWeight;
  }, 0);

  return Math.round(totalProgress / activeUploads.length);
}

// ============================================================================
// Mini Upload Item
// ============================================================================

function MiniUploadItem({
  upload,
  onCancel,
  onRetry,
  onClick,
}: {
  upload: UploadItem;
  onCancel: () => void;
  onRetry: () => void;
  onClick: () => void;
}) {
  const config = PHASE_CONFIG[upload.phase];
  const Icon = config.icon;

  const progress =
    upload.phase === "uploading"
      ? upload.uploadProgress
      : upload.phase === "parsing" || upload.phase === "analyzing"
        ? upload.parseProgress
        : upload.phase === "completed"
          ? 100
          : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/80",
        config.bgColor
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          config.bgColor
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            config.color,
            config.animate && "animate-spin"
          )}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{upload.filename}</p>
          <span className={cn("text-xs font-medium", config.color)}>
            {progress}%
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Progress
            value={progress}
            className={cn("h-1 flex-1", config.bgColor)}
          />
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(upload.fileSize)}
          </span>
          <span className={cn("text-xs", config.color)}>{config.label}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {upload.phase === "failed" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
        {(upload.phase === "queued" ||
          upload.phase === "uploading" ||
          upload.phase === "parsing") && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {upload.phase === "completed" && upload.demoId && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UploadTracker() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const {
    uploads,
    isUploading,
    isPaused,
    stats,
    clearCompleted,
    pauseAll,
    resumeAll,
    cancelUpload,
    retryUpload,
    removeUpload,
  } = useUploadStore();

  // Filter active/recent uploads (last 10)
  const visibleUploads = useMemo(() => {
    return uploads.slice(-10).reverse();
  }, [uploads]);

  const activeCount = useMemo(() => {
    return uploads.filter(
      (u) =>
        u.phase === "uploading" ||
        u.phase === "uploaded" ||
        u.phase === "parsing" ||
        u.phase === "analyzing" ||
        u.phase === "queued"
    ).length;
  }, [uploads]);

  const completedCount = stats.completedUploads;
  const failedCount = stats.failedUploads;
  const overallProgress = getOverallProgress(uploads);

  // Auto-close when all complete
  useEffect(() => {
    if (activeCount === 0 && completedCount > 0 && isOpen) {
      const timeout = setTimeout(() => {
        // Keep open if there were failures
        if (failedCount === 0) {
          setIsOpen(false);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [activeCount, completedCount, failedCount, isOpen]);

  // Don't render if no uploads
  if (uploads.length === 0) {
    return null;
  }

  const handleItemClick = (upload: UploadItem) => {
    if (upload.phase === "completed" && upload.demoId) {
      router.push(`/demos/${upload.demoId}`);
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative gap-2 h-9 px-3",
            activeCount > 0 && "text-primary",
            failedCount > 0 && "text-destructive"
          )}
        >
          {/* Animated upload icon */}
          <div className="relative">
            {activeCount > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : failedCount > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>

          {/* Progress text */}
          <span className="text-sm font-medium">
            {activeCount > 0 ? (
              <>
                {activeCount} upload{activeCount > 1 ? "s" : ""} ({overallProgress}%)
              </>
            ) : failedCount > 0 ? (
              <>
                {failedCount} failed
              </>
            ) : (
              <>
                {completedCount} complete
              </>
            )}
          </span>

          {/* Progress ring for active uploads */}
          {activeCount > 0 && (
            <svg className="absolute -inset-1 w-11 h-11 -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeOpacity="0.1"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={
                  2 * Math.PI * 18 * (1 - overallProgress / 100)
                }
                className="transition-all duration-300"
              />
            </svg>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Demo Uploads</h3>
          </div>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={isPaused ? resumeAll : pauseAll}
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
            )}
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={clearCompleted}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {uploads.length > 0 && (
          <div className="px-4 py-2 bg-muted/50 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {formatFileSize(stats.uploadedBytes)} / {formatFileSize(stats.totalBytes)}
            </span>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <span className="text-blue-400">{activeCount} active</span>
              )}
              {completedCount > 0 && (
                <span className="text-green-400">{completedCount} done</span>
              )}
              {failedCount > 0 && (
                <span className="text-red-400">{failedCount} failed</span>
              )}
            </div>
          </div>
        )}

        {/* Upload list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-2">
          {visibleUploads.length > 0 ? (
            visibleUploads.map((upload) => (
              <MiniUploadItem
                key={upload.id}
                upload={upload}
                onCancel={() => cancelUpload(upload.id)}
                onRetry={() => retryUpload(upload.id)}
                onClick={() => handleItemClick(upload)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No uploads</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              router.push("/demos");
              setIsOpen(false);
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload More Demos
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
