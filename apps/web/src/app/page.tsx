import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Upload,
  Users,
  Crosshair,
  TrendingUp,
  Shield,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">CS2 Analytics</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/demos"
              className="text-muted-foreground hover:text-foreground"
            >
              Demos
            </Link>
            <Link
              href="/players"
              className="text-muted-foreground hover:text-foreground"
            >
              Players
            </Link>
            <Link
              href="/analysis"
              className="text-muted-foreground hover:text-foreground"
            >
              Analysis
            </Link>
            <Button asChild>
              <Link href="/demos">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Professional CS2 Demo Analysis
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Upload your demos and get instant insights, statistics, and coaching
          recommendations to improve your gameplay.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/demos">
              <Upload className="mr-2 h-5 w-5" />
              Upload Demo
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/players">View Players</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<BarChart3 className="h-10 w-10" />}
            title="Detailed Statistics"
            description="Get comprehensive stats including ADR, KAST, rating, and more for every player in your demos."
          />
          <FeatureCard
            icon={<TrendingUp className="h-10 w-10" />}
            title="Performance Trends"
            description="Track player performance over time and identify areas for improvement."
          />
          <FeatureCard
            icon={<Users className="h-10 w-10" />}
            title="Team Analysis"
            description="Analyze team strategies, utility usage, and positioning patterns."
          />
          <FeatureCard
            icon={<Crosshair className="h-10 w-10" />}
            title="Round Replay"
            description="Interactive 2D replays with player positions, utility, and kill feed."
          />
          <FeatureCard
            icon={<Shield className="h-10 w-10" />}
            title="Coaching Insights"
            description="AI-powered recommendations to improve individual and team play."
          />
          <FeatureCard
            icon={<Upload className="h-10 w-10" />}
            title="Easy Upload"
            description="Simply drag and drop your .dem files to start analyzing immediately."
          />
        </div>
      </section>

      {/* Stats */}
      <section className="bg-muted py-16">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <StatCard value="40+" label="Events Tracked" />
            <StatCard value="60+" label="Player Properties" />
            <StatCard value="64" label="Tick Rate Support" />
            <StatCard value="100%" label="Data Extraction" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to improve your game?</h2>
        <p className="text-muted-foreground mb-8">
          Start analyzing your demos today and take your CS2 skills to the next
          level.
        </p>
        <Button size="lg" asChild>
          <Link href="/demos">Start Analyzing</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            <span className="font-semibold">CS2 Analytics</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for the CS2 community
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card p-6 rounded-lg border">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-primary mb-2">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
