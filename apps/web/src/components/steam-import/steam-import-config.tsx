"use client";

/**
 * Steam Import Configuration Component
 *
 * Allows users to setup and manage Steam match import.
 * Shows setup wizard for new users, configuration for existing users.
 */

import { useState, useEffect } from "react";
import { useSteamImportStore } from "@/stores/steam-import-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import {
  Download,
  ExternalLink,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  Unlink,
  Clock,
  Zap,
} from "lucide-react";
import { SteamMatchList } from "./steam-match-list";

export function SteamImportConfig() {
  const {
    isConfigured,
    config,
    syncStatus,
    lastSyncAt,
    lastSyncError,
    isSyncing,
    isLoading,
    error,
    setupImport,
    updateConfig,
    disconnect,
    triggerSync,
    refreshStatus,
    clearError,
  } = useSteamImportStore();

  const [step, setStep] = useState<"intro" | "setup" | "configured">("intro");
  const [authCode, setAuthCode] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [importPremier, setImportPremier] = useState(true);
  const [importCompetitive, setImportCompetitive] = useState(true);
  const [autoDownload, setAutoDownload] = useState(true);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Refresh status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Update step based on configuration
  useEffect(() => {
    if (isConfigured) {
      setStep("configured");
    } else {
      setStep("intro");
    }
  }, [isConfigured]);

  // Poll for sync status when syncing
  useEffect(() => {
    if (isSyncing) {
      const interval = setInterval(refreshStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isSyncing, refreshStatus]);

  const handleSetup = async () => {
    try {
      await setupImport({
        authCode: authCode.toUpperCase(),
        initialShareCode: shareCode,
        importPremier,
        importCompetitive,
        autoDownloadDemos: autoDownload,
      });
    } catch {
      // Error is handled by the store
    }
  };

  const handleSync = async () => {
    try {
      await triggerSync();
    } catch {
      // Error is handled by the store
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDisconnectDialog(false);
      setStep("intro");
      setAuthCode("");
      setShareCode("");
    } catch {
      // Error is handled by the store
    }
  };

  const handleConfigUpdate = async (
    field: "importPremier" | "importCompetitive" | "autoDownloadDemos",
    value: boolean,
  ) => {
    try {
      await updateConfig({ [field]: value });
    } catch {
      // Error is handled by the store
    }
  };

  // Render intro step
  if (step === "intro" && !isConfigured) {
    return (
      <div className="space-y-4">
        <Alert>
          <Download className="h-4 w-4" />
          <AlertTitle>Import your matches from Steam</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              Automatically import your Premier and Competitive match demos from
              Steam. You'll need:
            </p>
            <ol className="list-decimal ml-4 space-y-2">
              <li>
                <strong>Game Authentication Code</strong> - Get it from{" "}
                <a
                  href="https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Steam Help
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <strong>Share Code</strong> - Copy any share code from your
                recent match history in CS2
              </li>
            </ol>
          </AlertDescription>
        </Alert>

        <Button onClick={() => setStep("setup")}>
          <Zap className="mr-2 h-4 w-4" />
          Get Started
        </Button>
      </div>
    );
  }

  // Render setup form
  if (step === "setup" && !isConfigured) {
    return (
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authCode">Game Authentication Code</Label>
            <Input
              id="authCode"
              placeholder="XXXX-XXXXX-XXXX"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Get this from{" "}
              <a
                href="https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Steam Help
              </a>{" "}
              (select CS2 → "I want a game authentication code")
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shareCode">Initial Share Code</Label>
            <Input
              id="shareCode"
              placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Copy any share code from your recent match history in CS2
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Import Options</h4>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="importPremier">Premier Matches</Label>
                <p className="text-xs text-muted-foreground">
                  Import Premier ranked matches
                </p>
              </div>
              <Switch
                id="importPremier"
                checked={importPremier}
                onCheckedChange={setImportPremier}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="importCompetitive">Competitive Matches</Label>
                <p className="text-xs text-muted-foreground">
                  Import Competitive mode matches
                </p>
              </div>
              <Switch
                id="importCompetitive"
                checked={importCompetitive}
                onCheckedChange={setImportCompetitive}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoDownload">Auto-Download Demos</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically download demos after sync
                </p>
              </div>
              <Switch
                id="autoDownload"
                checked={autoDownload}
                onCheckedChange={setAutoDownload}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("intro")}>
            Back
          </Button>
          <Button
            onClick={handleSetup}
            disabled={
              isLoading ||
              !authCode.match(/^[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/) ||
              !shareCode.match(
                /^CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/,
              )
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Connect
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Render configured view
  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="link"
              className="p-0 h-auto ml-2"
              onClick={clearError}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {lastSyncError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Last sync failed</AlertTitle>
          <AlertDescription>{lastSyncError}</AlertDescription>
        </Alert>
      )}

      {/* Status & Sync */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                syncStatus === "ACTIVE"
                  ? "bg-green-500"
                  : syncStatus === "SYNCING"
                    ? "bg-yellow-500 animate-pulse"
                    : syncStatus === "ERROR"
                      ? "bg-red-500"
                      : "bg-gray-500"
              }`}
            />
            <span className="text-sm font-medium">
              {syncStatus === "ACTIVE"
                ? "Connected"
                : syncStatus === "SYNCING"
                  ? "Syncing..."
                  : syncStatus === "ERROR"
                    ? "Error"
                    : "Inactive"}
            </span>
          </div>
          {lastSyncAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last sync: {new Date(lastSyncAt).toLocaleString()}
            </p>
          )}
          {config && (
            <p className="text-xs text-muted-foreground">
              {config.totalMatchesSynced} matches synced
            </p>
          )}
        </div>

        <Button
          onClick={handleSync}
          disabled={isSyncing || syncStatus === "SYNCING"}
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {/* Configuration */}
      {config && (
        <div className="border rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Import Settings</h4>

          <div className="flex items-center justify-between">
            <div>
              <Label>Premier Matches</Label>
              <p className="text-xs text-muted-foreground">
                Import Premier ranked matches
              </p>
            </div>
            <Switch
              checked={config.importPremier}
              onCheckedChange={(checked) =>
                handleConfigUpdate("importPremier", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Competitive Matches</Label>
              <p className="text-xs text-muted-foreground">
                Import Competitive mode matches
              </p>
            </div>
            <Switch
              checked={config.importCompetitive}
              onCheckedChange={(checked) =>
                handleConfigUpdate("importCompetitive", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Download Demos</Label>
              <p className="text-xs text-muted-foreground">
                Automatically download demos after sync
              </p>
            </div>
            <Switch
              checked={config.autoDownloadDemos}
              onCheckedChange={(checked) =>
                handleConfigUpdate("autoDownloadDemos", checked)
              }
            />
          </div>
        </div>
      )}

      {/* Match List */}
      <SteamMatchList />

      {/* Disconnect */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDisconnectDialog(true)}
        >
          <Unlink className="mr-2 h-4 w-4" />
          Disconnect Steam Import
        </Button>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Steam Import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your Steam import configuration and all imported
              match records. Your downloaded demos will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
