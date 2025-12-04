"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart3,
  Target,
  Flame,
  Shield,
  TrendingUp,
  Users,
  Map,
  Lightbulb,
} from "lucide-react";

const analysisTypes = [
  {
    id: "overview",
    title: "Match Overview",
    description: "Complete match statistics and team comparison",
    icon: BarChart3,
    color: "text-blue-500",
  },
  {
    id: "opening-duels",
    title: "Opening Duels",
    description: "First kill analysis and entry success rates",
    icon: Target,
    color: "text-red-500",
  },
  {
    id: "clutches",
    title: "Clutch Analysis",
    description: "1vX situations and clutch success rates",
    icon: Flame,
    color: "text-orange-500",
  },
  {
    id: "trades",
    title: "Trade Analysis",
    description: "Trade kill timing and effectiveness",
    icon: Users,
    color: "text-purple-500",
  },
  {
    id: "economy",
    title: "Economy Analysis",
    description: "Round-by-round economy and buy decisions",
    icon: TrendingUp,
    color: "text-green-500",
  },
  {
    id: "utility",
    title: "Utility Usage",
    description: "Grenade effectiveness and usage patterns",
    icon: Shield,
    color: "text-yellow-500",
  },
  {
    id: "heatmaps",
    title: "Position Heatmaps",
    description: "Player positioning and movement patterns",
    icon: Map,
    color: "text-cyan-500",
  },
  {
    id: "coaching",
    title: "Coaching Insights",
    description: "AI-powered recommendations for improvement",
    icon: Lightbulb,
    color: "text-pink-500",
  },
];

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analysis</h1>
        <p className="text-muted-foreground">
          Deep dive into your gameplay with advanced analytics
        </p>
      </div>

      {/* Select Demo Prompt */}
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

      {/* Analysis Types */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Analysis Types</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {analysisTypes.map((type) => (
            <Card
              key={type.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            >
              <CardHeader className="pb-2">
                <type.icon className={`h-8 w-8 ${type.color}`} />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg">{type.title}</CardTitle>
                <CardDescription>{type.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Analyses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Analyses</CardTitle>
          <CardDescription>Your recently generated analyses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent analyses</p>
            <p className="text-sm">
              Select a demo to generate your first analysis
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
