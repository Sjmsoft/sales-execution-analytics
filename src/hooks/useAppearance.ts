import { useState, useEffect, useCallback } from "react";

export type ColorScheme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "penedge_color_scheme";
export const COMPACT_STORAGE_KEY = "penedge_compact_mode";
export const SIDEBAR_STORAGE_KEY = "penedge_sidebar_collapsed";

const APPEARANCE_EVENT = "penedge_appearance_change";

export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveEffectiveTheme(scheme: ColorScheme): "light" | "dark" {
  if (scheme === "dark") return "dark";
  if (scheme === "light") return "light";
  return getSystemPrefersDark() ? "dark" : "light";
}

/**
 * Directly applies data-theme and compact-mode classes to document element and body.
 */
export function applyAppearanceToDOM(scheme: ColorScheme, compact: boolean): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const effective = resolveEffectiveTheme(scheme);
  const isDark = effective === "dark";

  const root = document.documentElement;
  const body = document.body;

  root.setAttribute("data-theme", effective);
  if (isDark) {
    root.classList.add("dark");
    if (body) body.classList.add("dark");
  } else {
    root.classList.remove("dark");
    if (body) body.classList.remove("dark");
  }

  if (compact) {
    root.classList.add("compact-mode");
    if (body) body.classList.add("compact-mode");
  } else {
    root.classList.remove("compact-mode");
    if (body) body.classList.remove("compact-mode");
  }

  return effective;
}

export function useAppearance() {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ColorScheme | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {}
    return "light";
  });

  const [compactMode, setCompactModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COMPACT_STORAGE_KEY) === "true";
    } catch {}
    return false;
  });

  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {}
    return false;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    return resolveEffectiveTheme(colorScheme);
  });

  // Apply changes to DOM whenever colorScheme or compactMode changes
  useEffect(() => {
    const effective = applyAppearanceToDOM(colorScheme, compactMode);
    setResolvedTheme(effective);

    // If "system", watch for system dark mode changes
    if (colorScheme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const nextEffective = applyAppearanceToDOM("system", compactMode);
        setResolvedTheme(nextEffective);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handler);
      } else {
        // Compatibility for older browsers
        mediaQuery.addListener(handler);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handler);
        } else {
          mediaQuery.removeListener(handler);
        }
      };
    }
  }, [colorScheme, compactMode]);

  // Listen to external/cross-tab or layout changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const nextScheme = e.newValue as ColorScheme;
        if (nextScheme === "light" || nextScheme === "dark" || nextScheme === "system") {
          setColorSchemeState(nextScheme);
        }
      } else if (e.key === COMPACT_STORAGE_KEY && e.newValue !== null) {
        setCompactModeState(e.newValue === "true");
      } else if (e.key === SIDEBAR_STORAGE_KEY && e.newValue !== null) {
        setSidebarCollapsedState(e.newValue === "true");
      }
    };

    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<{
        colorScheme?: ColorScheme;
        compactMode?: boolean;
        sidebarCollapsed?: boolean;
      }>;
      if (custom.detail) {
        if (custom.detail.colorScheme) setColorSchemeState(custom.detail.colorScheme);
        if (custom.detail.compactMode !== undefined) setCompactModeState(custom.detail.compactMode);
        if (custom.detail.sidebarCollapsed !== undefined) {
          const nextVal = Boolean(custom.detail.sidebarCollapsed);
          setSidebarCollapsedState((curr) => (curr !== nextVal ? nextVal : curr));
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(APPEARANCE_EVENT, handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APPEARANCE_EVENT, handleCustomChange);
    };
  }, []);

  const setColorScheme = useCallback((nextScheme: ColorScheme) => {
    setColorSchemeState(nextScheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextScheme);
    } catch {}
    const effective = applyAppearanceToDOM(nextScheme, compactMode);
    setResolvedTheme(effective);
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_EVENT, { detail: { colorScheme: nextScheme } })
    );
  }, [compactMode]);

  const setCompactMode = useCallback((nextCompact: boolean) => {
    setCompactModeState(nextCompact);
    try {
      localStorage.setItem(COMPACT_STORAGE_KEY, String(nextCompact));
    } catch {}
    applyAppearanceToDOM(colorScheme, nextCompact);
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_EVENT, { detail: { compactMode: nextCompact } })
    );
  }, [colorScheme]);

  const setSidebarCollapsed = useCallback((nextCollapsed: boolean) => {
    setSidebarCollapsedState(nextCollapsed);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed));
    } catch {}
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(APPEARANCE_EVENT, { detail: { sidebarCollapsed: nextCollapsed } })
      );
    }, 0);
  }, []);

  const resetToDefaults = useCallback(() => {
    setColorScheme("light");
    setCompactMode(false);
    setSidebarCollapsed(false);
  }, [setColorScheme, setCompactMode, setSidebarCollapsed]);

  return {
    colorScheme,
    setColorScheme,
    compactMode,
    setCompactMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    resolvedTheme,
    resetToDefaults,
  };
}
