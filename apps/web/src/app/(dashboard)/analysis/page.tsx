"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { demosApi, type DemoListItem } from "@/lib/api";
import {
  BarChart3,
  Target,
  Flame,
  Shield,
  TrendingUp,
  Users,
  Map,
  Lightbulb,
  ArrowRight,
  FileVideo,
  Clock,
  CheckCircle,
  Loader2,
} from "lucide-react";

const analysisTypes = [
  {
    id: "overview",
    title: "Match Overview",
    description: "Complete match statistics and team comparison",
    icon: BarChart3,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "opening-duels",
    title: "Opening Duels",
    description: "First kill analysis and entry success rates",
    icon: Target,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    id: "clutches",
    title: "Clutch Analysis",
    description: "1vX situations and clutch success rates",
    icon: Flame,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "trades",
    title: "Trade Analysis",
    description: "Trade kill timing and effectiveness",
    icon: Users,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "economy",
    title: "Economy Analysis",
    description: "Round-by-round economy and buy decisions",
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    id: "utility",
    title: "Utility Usage",
    description: "Grenade effectiveness and usage patterns",
    icon: Shield,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    id: "heatmaps",
    title: "Position Heatmaps",
    description: "Player positioning and movement patterns",
    icon: Map,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    id: "coaching",
    title: "Coaching Insights",
    description: "AI-powered recommendations for improvement",
    icon: Lightbulb,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
];

function AnalysisPageContent() {
  const searchParams = useSearchParams();
  const selectedDemoId = searchParams.get("demo");
  const selectedType = searchParams.get("type");

  // Fetch recent demos for quick selection
  const { data: demosData } = useQuery({
    queryKey: ["demos-recent"],
    queryFn: () => demosApi.list({ limit: 5 }),
  });

  const recentDemos = demosData?.demos?.filter(
    (d) => d.status === "completed",
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analysis</h1>
        <p className="text-muted-foreground">
          Deep dive into your gameplay with advanced analytics
        </p>
      </div>

      {/* Select Demo Prompt or Current Demo */}
      {selectedDemoId ? (
        <Card className="bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Demo Selected</h3>
                  <p className="text-muted-foreground">
                    Choose an analysis type below
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link href="/demos">Change Demo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Select a Demo</h3>
                <p className="text-muted-foreground">
                  Choose a demo from your library to start analyzing
                </p>
              </div>
              <Button asChild>
                <Link href="/demos">Browse Demos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Demo Selection */}
      {!selectedDemoId && recentDemos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Select</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {recentDemos.map((demo) => (
              <Link
                key={demo.id}
                href={`/analysis?demo=${demo.id}`}
                className="block"
              >
                <Card className="hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer h-full">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileVideo className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm truncate">
                        {demo.mapName || "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {demo.team1Score ?? 0} - {demo.team2Score ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(demo.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Types */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Analysis Types</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {analysisTypes.map((type) => {
            const isSelected = selectedType === type.id;
            const href = selectedDemoId
              ? `/demos/${selectedDemoId}?analysis=${type.id}`
              : `/analysis?type=${type.id}`;

            return (
              <Link key={type.id} href={href}>
                <Card
                  className={`hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer h-full group ${
                    isSelected ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div
                      className={`w-12 h-12 rounded-xl ${type.bgColor} flex items-center justify-center`}
                    >
                      <type.icon className={`h-6 w-6 ${type.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{type.title}</CardTitle>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardDescription className="mt-1">
                      {type.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* No Demo Selected Warning */}
      {selectedType && !selectedDemoId && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/20">
                <FileVideo className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">No Demo Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Please select a demo first to run{" "}
                  {analysisTypes.find((t) => t.id === selectedType)?.title}{" "}
                  analysis
                </p>
              </div>
              <Button asChild>
                <Link href="/demos">Select Demo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Analyses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Analyses</CardTitle>
          <CardDescription>Your recently generated analyses</CardDescription>
        </CardHeader>
        <CardContent>
          {recentDemos.length > 0 ? (
            <div className="space-y-3">
              {recentDemos.slice(0, 3).map((demo) => (
                <Link
                  key={demo.id}
                  href={`/demos/${demo.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {demo.mapName || "Unknown Map"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {demo.team1Name ?? "Team 1"} vs{" "}
                        {demo.team2Name ?? "Team 2"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {demo.team1Score ?? 0} - {demo.team2Score ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(demo.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent analyses</p>
              <p className="text-sm">
                Select a demo to generate your first analysis
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnalysisPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading analysis...</p>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisPageLoading />}>
      <AnalysisPageContent />
    </Suspense>
  );
}
