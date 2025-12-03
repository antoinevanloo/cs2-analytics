"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { mapNameToDisplay, formatDuration } from "@/lib/utils";
import { DemoListItem } from "@/lib/api";
import {
  FileVideo,
  Clock,
  MoreVertical,
  Play,
  Download,
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
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    parsing: "bg-blue-500",
    completed: "bg-green-500",
    failed: "bg-red-500",
  };

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
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/demos/${demo.id}`}>
            <Play className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
