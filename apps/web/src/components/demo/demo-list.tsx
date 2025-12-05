"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mapNameToDisplay, formatDuration } from "@/lib/utils";
import { DemoListItem, demosApi } from "@/lib/api";
import {
  FileVideo,
  Clock,
  MoreVertical,
  Play,
  Download,
  Share2,
  BarChart3,
  Trash2,
  Loader2,
  Copy,
  Check,
} from "lucide-react";

interface DemoListProps {
  demos: DemoListItem[];
  isLoading: boolean;
}

export function DemoList({ demos, isLoading }: DemoListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (demos.length === 0) {
    return (
      <div className="text-center py-12">
        <FileVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No demos yet</h3>
        <p className="text-muted-foreground">
          Upload your first demo to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {demos.map((demo) => (
        <DemoRow key={demo.id} demo={demo} />
      ))}
    </div>
  );
}

function DemoRow({ demo }: { demo: DemoListItem }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    parsing: "bg-blue-500",
    completed: "bg-green-500",
    failed: "bg-red-500",
  };

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      await demosApi.download(demo.id, demo.filename);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [demo.id, demo.filename]);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/demos/${demo.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [demo.id]);

  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      {/* Map Icon */}
      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
        <FileVideo className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/demos/${demo.id}`}
            className="font-medium hover:underline truncate"
          >
            {demo.mapName ? mapNameToDisplay(demo.mapName) : demo.filename}
          </Link>
          <span
            className={`w-2 h-2 rounded-full ${statusColors[demo.status] || "bg-gray-500"}`}
          />
        </div>

        {demo.team1Name && demo.team2Name && (
          <p className="text-sm text-muted-foreground">
            {demo.team1Name}{" "}
            <span className="font-medium">
              {demo.team1Score} - {demo.team2Score}
            </span>{" "}
            {demo.team2Name}
          </p>
        )}

        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          {demo.durationSeconds && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(demo.durationSeconds)}
            </span>
          )}
          {demo.uploadedAt && (
            <span>
              Uploaded{" "}
              {formatDistanceToNow(new Date(demo.uploadedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {demo.status === "completed" && (
          <Button variant="ghost" size="icon" asChild title="View demo">
            <Link href={`/demos/${demo.id}`}>
              <Play className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={isDownloading}
          title="Download demo"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/demos/${demo.id}`} className="cursor-pointer">
                <BarChart3 className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            {demo.status === "completed" && (
              <DropdownMenuItem asChild>
                <Link
                  href={`/demos/${demo.id}/replay`}
                  className="cursor-pointer"
                >
                  <Play className="mr-2 h-4 w-4" />
                  2D Replay
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied!" : "Share Link"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDownload}
              disabled={isDownloading}
              className="cursor-pointer"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive cursor-pointer">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Demo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
