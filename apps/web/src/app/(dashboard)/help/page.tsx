"use client";

/**
 * Help & Support Page
 *
 * Comprehensive help center with FAQs, feature guides, and support options.
 * Designed for CS2 gamers with gaming-inspired UI.
 *
 * @module app/(dashboard)/help/page
 */

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileVideo,
  BarChart3,
  Users,
  Play,
  Upload,
  Settings,
  Crosshair,
  Target,
  Trophy,
  Flame,
  Shield,
  Zap,
  MessageCircle,
  Mail,
  Github,
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// FAQ data
const faqs = [
  {
    category: "Getting Started",
    icon: Zap,
    questions: [
      {
        q: "How do I upload a demo?",
        a: "Navigate to the Demos page and click 'Upload Demo'. You can drag & drop .dem files or click to select them from your computer. We support CS2 demos up to 500MB.",
      },
      {
        q: "How long does parsing take?",
        a: "Most demos are parsed within 1-3 minutes. Longer matches or higher tick-rate demos may take up to 5 minutes. You can continue using the app while parsing completes.",
      },
      {
        q: "What data is extracted from demos?",
        a: "We extract 40+ event types including kills, deaths, assists, grenades, positions, economy data, and more. Every player action at 64-tick resolution.",
      },
    ],
  },
  {
    category: "2D Replay",
    icon: Play,
    questions: [
      {
        q: "How do I use the 2D replay viewer?",
        a: "After a demo is parsed, click '2D Replay' on the demo detail page. Use the timeline to scrub through the round, and the play/pause controls to watch in real-time.",
      },
      {
        q: "Can I see utility usage in replays?",
        a: "Yes! Grenades are shown with their trajectory. Smokes, flashes, molotovs and HE grenades are all visualized on the radar.",
      },
      {
        q: "How do I jump to specific rounds?",
        a: "Use the round selector dropdown at the top of the replay viewer. You can also click on the round timeline on the demo detail page.",
      },
    ],
  },
  {
    category: "Statistics & Analysis",
    icon: BarChart3,
    questions: [
      {
        q: "How is the HLTV Rating 2.0 calculated?",
        a: "We use the exact HLTV formula: 0.0073*KAST + 0.3591*KPR + -0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587. Each component is weighted based on professional benchmarks.",
      },
      {
        q: "What does KAST mean?",
        a: "KAST measures the percentage of rounds where you contributed via a Kill, Assist, Survived, or were Traded. It's a key indicator of consistent impact.",
      },
      {
        q: "How accurate is the Impact rating?",
        a: "Impact combines multi-kills, opening kills, and clutch wins. We use the same formula as HLTV.org for maximum accuracy.",
      },
    ],
  },
  {
    category: "Account & Settings",
    icon: Settings,
    questions: [
      {
        q: "Can I connect my Steam account?",
        a: "Yes! Go to Settings > Integrations and click 'Connect' next to Steam. This links your Steam profile and enables automatic demo detection.",
      },
      {
        q: "How do I connect FACEIT?",
        a: "In Settings > Integrations, click 'Connect' next to FACEIT. After authorization, we'll sync your FACEIT matches and ELO history.",
      },
      {
        q: "Is my data private?",
        a: "By default, your demos and stats are private. You can adjust visibility in Settings > Privacy. Team members can see shared team demos.",
      },
    ],
  },
];

// Feature guides
const features = [
  {
    title: "Demo Upload",
    description: "Upload and parse your CS2 demo files",
    icon: Upload,
    href: "/demos",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Player Stats",
    description: "View detailed player statistics",
    icon: Users,
    href: "/players",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "Analysis Tools",
    description: "Deep dive into match analytics",
    icon: BarChart3,
    href: "/analysis",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "2D Replay",
    description: "Interactive round visualization",
    icon: Play,
    href: "/demos",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    title: "HLTV Rating",
    description: "Professional rating calculations",
    icon: Trophy,
    href: "/analysis",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    title: "Integrations",
    description: "Connect Steam and FACEIT",
    icon: Shield,
    href: "/settings",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
];

// Keyboard shortcuts - organized by category
const shortcutCategories = [
  {
    category: "Playback",
    shortcuts: [
      { keys: ["Space"], action: "Play/Pause replay" },
      { keys: ["←"], action: "Previous frame" },
      { keys: ["→"], action: "Next frame" },
      { keys: ["Shift", "←"], action: "Skip back 10 seconds" },
      { keys: ["Shift", "→"], action: "Skip forward 10 seconds" },
      { keys: ["Ctrl", "←"], action: "Skip back 5 seconds" },
      { keys: ["Ctrl", "→"], action: "Skip forward 5 seconds" },
    ],
  },
  {
    category: "Speed",
    shortcuts: [
      { keys: ["1"], action: "Speed 0.25x" },
      { keys: ["2"], action: "Speed 0.5x" },
      { keys: ["3"], action: "Speed 1x (normal)" },
      { keys: ["4"], action: "Speed 2x" },
      { keys: ["5"], action: "Speed 4x" },
    ],
  },
  {
    category: "Overlays",
    shortcuts: [
      { keys: ["K"], action: "Toggle kill lines" },
      { keys: ["G"], action: "Toggle grenades" },
      { keys: ["J"], action: "Toggle trajectories" },
      { keys: ["N"], action: "Toggle player names" },
      { keys: ["H"], action: "Toggle health bars" },
      { keys: ["T"], action: "Toggle movement trails" },
      { keys: ["R"], action: "Reset zoom/viewport" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["["], action: "Previous round" },
      { keys: ["]"], action: "Next round" },
      { keys: ["F"], action: "Toggle fullscreen" },
    ],
  },
];

// Flat shortcuts for backward compatibility
const shortcuts = shortcutCategories.flatMap((cat) => cat.shortcuts);

export default function HelpPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  // Filter FAQs based on search
  const filteredFaqs = faqs
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.questions.length > 0);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          Help & Support
        </h1>
        <p className="text-muted-foreground mt-1">
          Everything you need to master CS2 Analytics
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Quick Start Guides
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer h-full group">
                <CardContent className="pt-6">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
                      feature.bgColor,
                    )}
                  >
                    <feature.icon className={cn("h-6 w-6", feature.color)} />
                  </div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {filteredFaqs.map((category) => (
            <Card key={category.category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <category.icon className="h-5 w-5 text-primary" />
                  {category.category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {category.questions.map((faq, idx) => {
                  const id = `${category.category}-${idx}`;
                  const isExpanded = expandedFaq === id;

                  return (
                    <div
                      key={idx}
                      className="border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFaq(id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium pr-4">{faq.q}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 text-muted-foreground border-t bg-muted/30">
                          <p className="pt-4">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <Card id="keyboard-shortcuts" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Keyboard Shortcuts
          </CardTitle>
          <CardDescription>
            Master the 2D replay viewer with these shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shortcutCategories.map((category) => (
              <div key={category.category} className="space-y-3">
                <h4 className="text-sm font-semibold text-primary border-b pb-1">
                  {category.category}
                </h4>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {shortcut.action}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={key} className="flex items-center gap-1">
                            <kbd className="px-2 py-1 bg-muted border rounded text-xs font-mono min-w-[28px] text-center">
                              {key}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-semibold mb-2">Still need help?</h3>
              <p className="text-muted-foreground">
                Our team is here to help you get the most out of CS2 Analytics
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Discord
              </Button>
              <Button variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                GitHub
              </Button>
              <Button className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Us
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
