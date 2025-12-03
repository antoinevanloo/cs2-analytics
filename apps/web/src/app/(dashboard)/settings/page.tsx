"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  User,
  Bell,
  Shield,
  Palette,
  Link as LinkIcon,
  Database,
} from "lucide-react";

export default function SettingsPage() {
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
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Demo User</p>
              <p className="text-sm text-muted-foreground">demo@cs2analytics.com</p>
            </div>
            <Button variant="outline" className="ml-auto">
              Edit Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <CardTitle>Integrations</CardTitle>
          </div>
          <CardDescription>Connect external accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <IntegrationRow
            name="Steam"
            description="Import demos and link your Steam profile"
            connected={false}
          />
          <IntegrationRow
            name="Faceit"
            description="Sync Faceit matches and ELO"
            connected={false}
          />
          <IntegrationRow
            name="ESEA"
            description="Import ESEA matches and RWS"
            connected={false}
          />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Manage notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationRow
            title="Analysis Complete"
            description="Get notified when demo analysis finishes"
            enabled={true}
          />
          <NotificationRow
            title="New Team Member"
            description="Get notified when someone joins your team"
            enabled={true}
          />
          <NotificationRow
            title="Weekly Summary"
            description="Receive weekly performance summary"
            enabled={false}
          />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
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
              <Button variant="outline" size="sm">Light</Button>
              <Button variant="default" size="sm">Dark</Button>
              <Button variant="outline" size="sm">System</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Data & Storage</CardTitle>
          </div>
          <CardDescription>Manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Storage Used</p>
              <p className="text-sm text-muted-foreground">
                0 GB of 10 GB used
              </p>
            </div>
            <Button variant="outline">Manage Storage</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Data</p>
              <p className="text-sm text-muted-foreground">
                Download all your data
              </p>
            </div>
            <Button variant="outline">Export</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and data
              </p>
            </div>
            <Button variant="destructive">Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationRow({
  name,
  description,
  connected,
}: {
  name: string;
  description: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant={connected ? "outline" : "default"}>
        {connected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}

function NotificationRow({
  title,
  description,
  enabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="ghost" size="sm">
        {enabled ? "On" : "Off"}
      </Button>
    </div>
  );
}
