"use client";

/**
 * Steam Match List Component
 *
 * Displays a paginated list of imported Steam matches with actions.
 */

import { useEffect, useState } from "react";
import { useSteamImportStore } from "@/stores/steam-import-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileDown,
  RefreshCw,
} from "lucide-react";

type MatchDownloadStatus =
  | "PENDING"
  | "URL_FETCHED"
  | "DOWNLOADING"
  | "DOWNLOADED"
  | "PARSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "UNAVAILABLE";

const STATUS_CONFIG: Record<
  MatchDownloadStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  URL_FETCHED: {
    label: "Ready",
    variant: "outline",
    icon: <FileDown className="h-3 w-3" />,
  },
  DOWNLOADING: {
    label: "Downloading",
    variant: "default",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  DOWNLOADED: {
    label: "Downloaded",
    variant: "default",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  PARSING: {
    label: "Parsing",
    variant: "default",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  COMPLETED: {
    label: "Completed",
    variant: "default",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  FAILED: {
    label: "Failed",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
  EXPIRED: {
    label: "Expired",
    variant: "destructive",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  UNAVAILABLE: {
    label: "Unavailable",
    variant: "secondary",
    icon: <XCircle className="h-3 w-3" />,
  },
};

export function SteamMatchList() {
  const {
    matches,
    matchesLoading,
    matchesPagination,
    isLoading,
    loadMatches,
    triggerDownload,
    removeMatch,
    refreshAllPendingInfo,
  } = useSteamImportStore();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [downloadingMatch, setDownloadingMatch] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load matches on mount and when filter changes
  useEffect(() => {
    const status = statusFilter === "all" ? undefined : (statusFilter as MatchDownloadStatus);
    loadMatches(1, status);
  }, [statusFilter, loadMatches]);

  // Auto-refresh when there are active downloads (gamification: real-time progress)
  useEffect(() => {
    const hasActiveDownloads = matches.some(
      (m) => ["DOWNLOADING", "PARSING"].includes(m.downloadStatus)
    );

    if (!hasActiveDownloads) return;

    const intervalId = setInterval(() => {
      const status = statusFilter === "all" ? undefined : (statusFilter as MatchDownloadStatus);
      loadMatches(matchesPagination.page, status);
    }, 2000); // Refresh every 2 seconds during active downloads

    return () => clearInterval(intervalId);
  }, [matches, statusFilter, matchesPagination.page, loadMatches]);

  const handlePageChange = (page: number) => {
    const status = statusFilter === "all" ? undefined : (statusFilter as MatchDownloadStatus);
    loadMatches(page, status);
  };

  const handleDownload = async (matchId: string) => {
    setDownloadingMatch(matchId);
    try {
      await triggerDownload(matchId);
    } finally {
      setDownloadingMatch(null);
    }
  };

  const handleDelete = async () => {
    if (!matchToDelete) return;
    try {
      await removeMatch(matchToDelete);
    } finally {
      setMatchToDelete(null);
    }
  };

  const handleRefreshAllInfo = async () => {
    setIsRefreshing(true);
    try {
      await refreshAllPendingInfo();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Count matches that need info refresh (missing scores - map name is only available after download)
  const matchesNeedingInfo = matches.filter(
    (m) => m.team1Score === null || m.team2Score === null
  ).length;

  const canDownload = (status: string) => {
    return ["PENDING", "URL_FETCHED", "FAILED", "EXPIRED"].includes(status);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const formatBytes = (bytes: string | null) => {
    if (!bytes) return "0 B";
    const num = parseInt(bytes, 10);
    if (num === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return `${(num / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (matchesLoading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Imported Matches</h4>
        <div className="flex items-center gap-2">
          {matchesNeedingInfo > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAllInfo}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh Info ({matchesNeedingInfo})
            </Button>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Match table */}
      {matches.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No matches found. Click "Sync Now" to import matches from Steam.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Map</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => {
                const statusConfig = STATUS_CONFIG[match.downloadStatus as MatchDownloadStatus];
                return (
                  <TableRow key={match.id}>
                    <TableCell className="font-medium">
                      {match.mapName === "TBD" || match.mapName === "unknown" || !match.mapName ? (
                        <span className="text-muted-foreground italic text-xs">Unknown yet</span>
                      ) : (
                        match.mapName
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {match.gameMode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {match.team1Score !== null && match.team2Score !== null ? (
                        <span
                          className={
                            match.matchResult === "WIN"
                              ? "text-green-600 font-semibold"
                              : match.matchResult === "LOSS"
                                ? "text-red-600"
                                : "text-yellow-600"
                          }
                        >
                          {match.team1Score} - {match.team2Score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(match.matchTime)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(match.matchDuration)}
                    </TableCell>
                    <TableCell>
                      {/* Show progress bar for active states */}
                      {["DOWNLOADING", "PARSING"].includes(match.downloadStatus) ? (
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {match.currentStep === "FETCHING_URL" && "Fetching URL..."}
                              {match.currentStep === "DOWNLOADING" && "Downloading..."}
                              {match.currentStep === "DECOMPRESSING" && "Decompressing..."}
                              {match.currentStep === "PARSING" && "Parsing..."}
                              {!match.currentStep && statusConfig?.label}
                            </span>
                            <span className="font-medium">{match.downloadProgress}%</span>
                          </div>
                          <Progress value={match.downloadProgress} className="h-2" />
                          {match.downloadedBytes && match.totalBytes && (
                            <div className="text-[10px] text-muted-foreground">
                              {formatBytes(match.downloadedBytes)} / {formatBytes(match.totalBytes)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge
                          variant={statusConfig?.variant || "secondary"}
                          className="flex items-center gap-1 w-fit"
                        >
                          {statusConfig?.icon}
                          {statusConfig?.label || match.downloadStatus}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canDownload(match.downloadStatus) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(match.id)}
                            disabled={downloadingMatch === match.id}
                          >
                            {downloadingMatch === match.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {match.demoId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={`/demos/${match.demoId}`}>
                              <FileDown className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMatchToDelete(match.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {matchesPagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {matchesPagination.page} of {matchesPagination.totalPages} ({matchesPagination.total} matches)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(matchesPagination.page - 1)}
              disabled={matchesPagination.page === 1 || matchesLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(matchesPagination.page + 1)}
              disabled={
                matchesPagination.page === matchesPagination.totalPages ||
                matchesLoading
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!matchToDelete}
        onOpenChange={(open) => !open && setMatchToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the match from your import list. If the demo was
              downloaded, it will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
