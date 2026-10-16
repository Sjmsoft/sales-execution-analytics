import type { CSSProperties, ReactNode } from "react";
import LogoLoader from "../brand/LogoLoader";

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  variant?: "text" | "circular" | "rectangular" | "rounded" | "card";
  children?: ReactNode;
};

/**
 * Base Shimmer Skeleton primitive
 */
export function Skeleton({
  className = "",
  width,
  height,
  borderRadius,
  style = {},
  variant = "rounded",
  children,
}: SkeletonProps) {
  const customStyle: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : {}),
    ...(borderRadius !== undefined
      ? { borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius }
      : {}),
  };

  return (
    <div
      className={`skeleton-pulse skeleton-${variant} ${className}`}
      style={customStyle}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/**
 * Multi-line Text Skeleton
 */
export function SkeletonText({
  lines = 3,
  gap = 8,
  lastLineWidth = "60%",
  className = "",
}: {
  lines?: number;
  gap?: number;
  lastLineWidth?: string;
  className?: string;
}) {
  return (
    <div className={`skeleton-text-block ${className}`} style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          height={14}
          width={idx === lines - 1 ? lastLineWidth : "100%"}
          borderRadius={4}
        />
      ))}
    </div>
  );
}

/**
 * Data-loading placeholders.
 * These used to render shimmer skeletons; they now render the branded
 * 3D Pen Edge logo loader so loading feels consistent across the app.
 * Signatures are kept so existing call sites keep working.
 */

/**
 * Table / list loading state
 */
export function TableSkeleton(props: {
  rows?: number;
  cols?: number;
  className?: string;
  message?: string;
}) {
  return (
    <LogoLoader
      variant="section"
      className={props.className}
      message={props.message ?? "Loading records"}
    />
  );
}

/**
 * Executive dashboard loading state
 */
export function DashboardSkeleton() {
  return (
    <LogoLoader
      variant="page"
      message="Loading dashboard insights"
      hint="Crunching sales, visits and targets"
    />
  );
}

/**
 * Outlet visits history loading state
 */
export function VisitsPageSkeleton() {
  return (
    <LogoLoader
      variant="page"
      message="Loading outlet visits"
      hint="Fetching visit history and attendance"
    />
  );
}

/**
 * Attendance / check-in form loading state
 */
export function AttendanceFormSkeleton({ title = "Daily Attendance Check-In" }: { title?: string } = {}) {
  return (
    <LogoLoader
      variant="page"
      message={`Preparing ${title}`}
      hint="Locating you and loading outlets"
    />
  );
}

/**
 * Outlets directory loading state
 */
export function OutletsSkeleton() {
  return (
    <LogoLoader
      variant="page"
      message="Loading outlets directory"
      hint="Mapping stores in your territory"
    />
  );
}

/**
 * Settings page loading state
 */
export function SettingsSkeleton() {
  return <LogoLoader variant="page" message="Loading settings" />;
}
