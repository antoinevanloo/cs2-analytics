"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Crosshair,
  FileVideo,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
} from "lucide-react";

const navigation = [
  { name: "Demos", href: "/demos", icon: FileVideo },
  { name: "Players", href: "/players", icon: Users },
  { name: "Analysis", href: "/analysis", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b">
        <Crosshair className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold">CS2 Analytics</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Link
          href="/help"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <HelpCircle className="h-5 w-5" />
          Help & Support
        </Link>
      </div>
    </aside>
  );
}
