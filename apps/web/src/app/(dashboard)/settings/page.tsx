"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Bell,
  Palette,
  Link as LinkIcon,
  Database,
  Check,
  ExternalLink,
  Loader2,
  Moon,
  Sun,
  Monitor,
  Trash2,
  Download,
  HardDrive,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { userApi, type UserPreferences } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Integration status type
type IntegrationStatus = "connected" | "disconnected" | "connecting";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: IntegrationStatus;
  username?: string;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();

  // Integrations state - Initialize based on user data
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "steam",
      name: "Steam",
      description: "Import demos and link your Steam profile",
      icon: "S",
      status: "disconnected",
    },
    {
      id: "faceit",
      name: "FACEIT",
      description: "Sync FACEIT matches and ELO",
      icon: "F",
      status: "disconnected",
    },
  ]);

  // Update integration status based on user data
  useEffect(() => {
    if (user) {
      setIntegrations((prev) =>
        prev.map((integration) => {
          if (integration.id === "steam" && user.steamId) {
            return {
              ...integration,
              status: "connected" as IntegrationStatus,
              username: user.steamId,
            };
          }
          if (integration.id === "faceit" && user.faceitId) {
            return {
              ...integration,
              status: "connected" as IntegrationStatus,
              username: user.faceitId,
            };
          }
          return integration;
        }),
      );
    }
  }, [user]);

  // Notifications state
  const [notifications, setNotifications] = useState({
    analysisComplete: true,
    newTeamMember: true,
    weeklySummary: false,
    performanceAlerts: true,
  });

  // Storage state
  const [storageUsed] = useState(2.4);
  const [storageTotal] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle integration connect/disconnect
  const handleIntegration = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);

    // If already connected, disconnect
    if (integration?.status === "connected") {
      // TODO: Call disconnect API
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: "disconnected" as IntegrationStatus, username: undefined }
            : i,
        ),
      );
      return;
    }

    // Set to connecting state
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "connecting" as IntegrationStatus } : i,
      ),
    );

    // Redirect to OAuth endpoint - opens in same window for proper OAuth flow
    const authUrl = `${API_URL}/v1/auth/${id}`;
    window.location.href = authUrl;
  };

  // Handle notification toggle
  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Call export API
      const response = await fetch(`${API_URL}/v1/user/me/export`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Show success message
        setExportMessage("Export started! You will receive an email when ready.");
      } else {
        setExportMessage("Export failed. Please try again.");
      }
    } catch (error) {
      console.error("Export error:", error);
      setExportMessage("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const [exportMessage, setExportMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "User"}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium text-lg">{user?.name || "Guest User"}</p>
              <p className="text-sm text-muted-foreground">
                {user?.email || "Not signed in"}
              </p>
              {user?.steamId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Steam ID: {user.steamId}
                </p>
              )}
            </div>
            <Button variant="outline">Edit Profile</Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            <CardTitle>Integrations</CardTitle>
          </div>
          <CardDescription>Connect external accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center font-bold text-lg">
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{integration.name}</p>
                    {integration.status === "connected" && (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <Check className="h-3 w-3" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {integration.status === "connected" && integration.username
                      ? `Linked as ${integration.username}`
                      : integration.description}
                  </p>
                </div>
              </div>
              <Button
                variant={
                  integration.status === "connected" ? "outline" : "default"
                }
                onClick={() => handleIntegration(integration.id)}
                disabled={integration.status === "connecting"}
              >
                {integration.status === "connecting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : integration.status === "connected" ? (
                  "Disconnect"
                ) : (
                  <>
                    Connect
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card id="notifications">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Manage notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationRow
            title="Analysis Complete"
            description="Get notified when demo analysis finishes"
            enabled={notifications.analysisComplete}
            onToggle={() => toggleNotification("analysisComplete")}
          />
          <NotificationRow
            title="New Team Member"
            description="Get notified when someone joins your team"
            enabled={notifications.newTeamMember}
            onToggle={() => toggleNotification("newTeamMember")}
          />
          <NotificationRow
            title="Weekly Summary"
            description="Receive weekly performance summary"
            enabled={notifications.weeklySummary}
            onToggle={() => toggleNotification("weeklySummary")}
          />
          <NotificationRow
            title="Performance Alerts"
            description="Get alerts when your stats change significantly"
            enabled={notifications.performanceAlerts}
            onToggle={() => toggleNotification("performanceAlerts")}
          />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
                className="gap-2"
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Storage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Data & Storage</CardTitle>
          </div>
          <CardDescription>Manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Storage Usage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Storage Used</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {storageUsed} GB of {storageTotal} GB
              </span>
            </div>
            <Progress value={(storageUsed / storageTotal) * 100} />
            <p className="text-xs text-muted-foreground">
              {(storageTotal - storageUsed).toFixed(1)} GB available
            </p>
          </div>

          {/* Export Data */}
          <div className="flex items-center justify-between py-3 border-t">
            <div>
              <p className="font-medium">Export Data</p>
              <p className="text-sm text-muted-foreground">
                Download all your demos and analytics data
              </p>
              {exportMessage && (
                <p
                  className={`text-sm mt-1 ${
                    exportMessage.includes("failed")
                      ? "text-destructive"
                      : "text-green-500"
                  }`}
                >
                  {exportMessage}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isExporting ? "Preparing..." : "Export"}
            </Button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between py-3 border-t">
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            {showDeleteConfirm ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" size="sm">
                  Confirm Delete
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
