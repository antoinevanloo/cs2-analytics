"use client";

/**
 * Dashboard Role Switcher
 *
 * Dropdown component for switching between different role-based dashboards.
 * Shows current role and allows quick switching with role descriptions.
 *
 * @module components/dashboard/dashboard-switcher
 */

import { useCallback, useState } from "react";
import { ChevronDown, User, Users, Search, BarChart3, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type PreferredRole,
  ROLE_METADATA,
} from "@/stores/preferences-store";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface DashboardSwitcherProps {
  currentRole: PreferredRole;
  onRoleChange: (role: PreferredRole) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Icon mapping
// ============================================================================

const ROLE_ICONS: Record<PreferredRole, React.ComponentType<{ className?: string }>> = {
  PLAYER: User,
  COACH: Users,
  SCOUT: Search,
  ANALYST: BarChart3,
  CREATOR: Video,
};

// ============================================================================
// Component
// ============================================================================

export function DashboardSwitcher({
  currentRole,
  onRoleChange,
  isLoading = false,
  disabled = false,
  className,
}: DashboardSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentMeta = ROLE_METADATA[currentRole];
  const CurrentIcon = ROLE_ICONS[currentRole];

  const handleRoleSelect = useCallback(
    (role: PreferredRole) => {
      if (role !== currentRole) {
        onRoleChange(role);
      }
      setIsOpen(false);
    },
    [currentRole, onRoleChange],
  );

  const roles = Object.entries(ROLE_METADATA) as [PreferredRole, typeof currentMeta][];

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full justify-between min-w-[200px]",
          isLoading && "opacity-70",
        )}
      >
        <div className="flex items-center gap-2">
          <CurrentIcon className="h-4 w-4 text-muted-foreground" />
          <span>{currentMeta.label} Dashboard</span>
        </div>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div
            role="listbox"
            className={cn(
              "absolute top-full left-0 right-0 z-50 mt-1",
              "bg-popover border rounded-md shadow-lg",
              "animate-in fade-in-0 zoom-in-95",
            )}
          >
            {roles.map(([role, meta]) => {
              const Icon = ROLE_ICONS[role];
              const isSelected = role === currentRole;

              return (
                <button
                  key={role}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleRoleSelect(role)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 text-left",
                    "hover:bg-accent transition-colors",
                    "first:rounded-t-md last:rounded-b-md",
                    isSelected && "bg-accent/50",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 mt-0.5",
                      isSelected ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{meta.label}</span>
                      {isSelected && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                      {meta.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Compact variant for sidebar/header
// ============================================================================

interface CompactSwitcherProps {
  currentRole: PreferredRole;
  onRoleChange: (role: PreferredRole) => void;
  className?: string;
}

export function CompactRoleSwitcher({
  currentRole,
  onRoleChange,
  className,
}: CompactSwitcherProps) {
  const roles: PreferredRole[] = ["PLAYER", "COACH", "SCOUT", "ANALYST", "CREATOR"];

  return (
    <div className={cn("flex gap-1", className)}>
      {roles.map((role) => {
        const Icon = ROLE_ICONS[role];
        const isSelected = role === currentRole;

        return (
          <button
            key={role}
            onClick={() => onRoleChange(role)}
            title={ROLE_METADATA[role].label}
            className={cn(
              "p-2 rounded-md transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
