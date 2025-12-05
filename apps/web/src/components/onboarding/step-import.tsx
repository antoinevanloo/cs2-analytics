"use client";

/**
 * Step Import - Match import step
 *
 * Handles auto-import of matches from FACEIT/Steam.
 *
 * @module components/onboarding/step-import
 */

import { useState } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ImportSource, ImportStatus } from "@/stores/onboarding-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Download,
  Loader2,
  X,
  AlertCircle,
  SkipForward,
} from "lucide-react";

// ============================================================================
// Component
// ============================================================================

export function StepImport() {
  const {
    connectedAccounts,
    importProgress,
    isStartingImport,
    isPollingImport,
    importError,
    startImport,
    skipImport,
    cancelImport,
    nextStep,
  } = useOnboarding();

  const [matchCount, setMatchCount] = useState(10);
  const [enableAutoImport, setEnableAutoImport] = useState(true);

  // Determine available sources
  const availableSources: ImportSource[] = [];
  if (connectedAccounts.faceit) availableSources.push(ImportSource.FACEIT);
  if (connectedAccounts.steam) availableSources.push(ImportSource.STEAM);

  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(
    availableSources[0] ?? null,
  );

  const isImporting =
    importProgress?.status === ImportStatus.IN_PROGRESS ||
    importProgress?.status === ImportStatus.QUEUED;
  const isComplete = importProgress?.status === ImportStatus.COMPLETED;
  const isFailed = importProgress?.status === ImportStatus.FAILED;

  const handleStartImport = async () => {
    if (!selectedSource) return;
    await startImport(selectedSource, matchCount, enableAutoImport);
  };

  const handleSkip = async () => {
    await skipImport("Skipped during onboarding");
    nextStep();
  };

  // No accounts connected
  if (availableSources.length === 0) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-2xl font-bold">No Accounts Connected</h2>
        <p className="mb-6 text-muted-foreground">
          Connect your Steam or FACEIT account to import matches automatically.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSkip}>
            <SkipForward className="mr-2 h-4 w-4" />
            Skip for Now
          </Button>
          <Button onClick={nextStep}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold">Import Your Matches</h2>
        <p className="text-muted-foreground">
          Import your recent matches to start analyzing your performance
        </p>
      </div>

      {/* Import progress */}
      {(isImporting || isComplete || isFailed) && importProgress ? (
        <div className="mb-8">
          <div className="rounded-lg border bg-card p-6">
            {/* Status header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isImporting ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : isComplete ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <X className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {isImporting
                    ? "Importing matches..."
                    : isComplete
                      ? "Import complete!"
                      : "Import failed"}
                </span>
              </div>
              {isImporting && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelImport}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {importProgress.matchesImported} of{" "}
                  {importProgress.matchesTotal} matches
                </span>
                <span className="font-medium">{importProgress.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all",
                    isComplete
                      ? "bg-green-500"
                      : isFailed
                        ? "bg-destructive"
                        : "bg-primary",
                  )}
                  style={{ width: `${importProgress.progress}%` }}
                />
              </div>
            </div>

            {/* Current match info */}
            {importProgress.currentMatch && isImporting && (
              <div className="text-sm text-muted-foreground">
                <span>Processing: </span>
                <span className="font-medium">
                  {importProgress.currentMatch.map}
                </span>
                <span className="ml-2 text-xs">
                  ({importProgress.currentMatch.date})
                </span>
              </div>
            )}

            {/* Error message */}
            {isFailed && importProgress.error && (
              <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {importProgress.error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Source selection */}
          {availableSources.length > 1 && (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">
                Import from
              </label>
              <div className="flex gap-3">
                {availableSources.map((source) => (
                  <button
                    key={source}
                    onClick={() => setSelectedSource(source)}
                    className={cn(
                      "flex-1 rounded-lg border-2 p-4 text-center transition-colors",
                      selectedSource === source
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    <span className="font-medium">{source}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Match count */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">
              Number of matches to import
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  onClick={() => setMatchCount(count)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-center transition-colors",
                    matchCount === count
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-import toggle */}
          {connectedAccounts.faceit && (
            <div className="mb-8">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4">
                <input
                  type="checkbox"
                  checked={enableAutoImport}
                  onChange={(e) => setEnableAutoImport(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <span className="font-medium">Enable auto-import</span>
                  <p className="text-sm text-muted-foreground">
                    Automatically import new FACEIT matches as you play
                  </p>
                </div>
              </label>
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleSkip} disabled={isImporting}>
          <SkipForward className="mr-2 h-4 w-4" />
          Skip
        </Button>

        {isComplete ? (
          <Button onClick={nextStep} className="gap-2">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleStartImport}
            disabled={!selectedSource || isStartingImport || isImporting}
            className="gap-2"
          >
            {isStartingImport ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="h-4 w-4" />
                Start Import
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
