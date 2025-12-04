/**
 * Rating Badge - Compact display of HLTV Rating 2.0
 *
 * Shows the rating value with color-coded background based on performance tier.
 */

import { cn } from "@/lib/utils";

interface RatingBadgeProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/**
 * Get rating tier and color based on HLTV benchmarks
 */
function getRatingTier(rating: number): {
  label: string;
  bgColor: string;
  textColor: string;
} {
  if (rating >= 1.3) {
    return {
      label: "GOAT",
      bgColor: "bg-purple-500/20",
      textColor: "text-purple-500",
    };
  }
  if (rating >= 1.25) {
    return {
      label: "Elite",
      bgColor: "bg-yellow-500/20",
      textColor: "text-yellow-500",
    };
  }
  if (rating >= 1.2) {
    return {
      label: "Excellent",
      bgColor: "bg-green-500/20",
      textColor: "text-green-500",
    };
  }
  if (rating >= 1.1) {
    return {
      label: "Good",
      bgColor: "bg-emerald-500/20",
      textColor: "text-emerald-500",
    };
  }
  if (rating >= 1.0) {
    return {
      label: "Average",
      bgColor: "bg-blue-500/20",
      textColor: "text-blue-500",
    };
  }
  if (rating >= 0.9) {
    return {
      label: "Below Avg",
      bgColor: "bg-orange-500/20",
      textColor: "text-orange-500",
    };
  }
  return {
    label: "Poor",
    bgColor: "bg-red-500/20",
    textColor: "text-red-500",
  };
}

const sizeClasses = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1.5",
};

export function RatingBadge({
  rating,
  size = "md",
  showLabel = false,
  className,
}: RatingBadgeProps) {
  const tier = getRatingTier(rating);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-semibold",
        tier.bgColor,
        tier.textColor,
        sizeClasses[size],
        className,
      )}
    >
      <span>{rating.toFixed(2)}</span>
      {showLabel && (
        <span className="text-[0.7em] opacity-80">{tier.label}</span>
      )}
    </span>
  );
}

export { getRatingTier };
