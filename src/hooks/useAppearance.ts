import { useState, useEffect, useCallback } from "react";

export type ColorScheme = "light" | "dark" | "system";

export type ThemeColor =
  | "emerald"
  | "blue"
  | "purple"
  | "amber"
  | "rose"
  | "teal"
  | "slate";

export interface ThemeColorOption {
  id: ThemeColor;
  name: string;
  tagline: string;
  primaryHex: string;
  accentHex: string;
  gradient: string;
  badgeLabel?: string;
}

export const THEME_COLOR_OPTIONS: ThemeColorOption[] = [
  {
    id: "emerald",
    name: "Emerald Forest",
    tagline: "PenEdge signature enterprise emerald & fresh mint",
    primaryHex: "#075544",
    accentHex: "#10b981",
    gradient: "linear-gradient(135deg, #075544 0%, #10b981 100%)",
    badgeLabel: "Default",
  },
  {
    id: "blue",
    name: "Ocean Sapphire",
    tagline: "Corporate executive royal blue & vibrant sapphire",
    primaryHex: "#1d4ed8",
    accentHex: "#3b82f6",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
  },
  {
    id: "purple",
    name: "Royal Amethyst",
    tagline: "Regal executive violet & luminous amethyst",
    primaryHex: "#6d28d9",
    accentHex: "#8b5cf6",
    gradient: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)",
  },
  {
    id: "amber",
    name: "Sunset Amber",
    tagline: "High-energy warm amber & metallic bronze",
    primaryHex: "#d97706",
    accentHex: "#f59e0b",
    gradient: "linear-gradient(135deg, #78350f 0%, #f59e0b 100%)",
  },
  {
    id: "rose",
    name: "Crimson Ruby",
    tagline: "Bold crimson ruby & dynamic high-contrast rose",
    primaryHex: "#be123c",
    accentHex: "#f43f5e",
    gradient: "linear-gradient(135deg, #881337 0%, #f43f5e 100%)",
  },
  {
    id: "teal",
    name: "Oceanic Teal",
    tagline: "Crisp modern teal & vibrant oceanic turquoise",
    primaryHex: "#0e7490",
    accentHex: "#06b6d4",
    gradient: "linear-gradient(135deg, #164e63 0%, #06b6d4 100%)",
  },
  {
    id: "slate",
    name: "Midnight Slate",
    tagline: "Architectural carbon slate & monochrome titanium",
    primaryHex: "#334155",
    accentHex: "#64748b",
    gradient: "linear-gradient(135deg, #0f172a 0%, #64748b 100%)",
  },
];

export const THEME_STORAGE_KEY = "penedge_color_scheme";
export const THEME_COLOR_STORAGE_KEY = "penedge_theme_color";
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
 * Directly applies data-theme, data-theme-color, and compact-mode classes to document element and body.
 */
export function applyAppearanceToDOM(
  scheme: ColorScheme,
  compact: boolean,
  themeColor: ThemeColor = "emerald"
): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const effective = resolveEffectiveTheme(scheme);
  const isDark = effective === "dark";

  const root = document.documentElement;
  const body = document.body;

  root.setAttribute("data-theme", effective);
  root.setAttribute("data-theme-color", themeColor);
  if (body) {
    body.setAttribute("data-theme", effective);
    body.setAttribute("data-theme-color", themeColor);
  }

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

  // Update meta theme-color tag if present
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const selected = THEME_COLOR_OPTIONS.find((t) => t.id === themeColor);
    if (selected) {
      metaThemeColor.setAttribute(
        "content",
        isDark ? "#070e0c" : selected.primaryHex
      );
    }
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

  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    try {
      const saved = localStorage.getItem(THEME_COLOR_STORAGE_KEY) as ThemeColor | null;
      if (
        saved === "emerald" ||
        saved === "blue" ||
        saved === "purple" ||
        saved === "amber" ||
        saved === "rose" ||
        saved === "teal" ||
        saved === "slate"
      ) {
        return saved;
      }
    } catch {}
    return "emerald";
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

  // Apply changes to DOM whenever colorScheme, compactMode, or themeColor changes
  useEffect(() => {
    const effective = applyAppearanceToDOM(colorScheme, compactMode, themeColor);
    setResolvedTheme(effective);

    // If "system", watch for system dark mode changes
    if (colorScheme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const nextEffective = applyAppearanceToDOM("system", compactMode, themeColor);
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
  }, [colorScheme, compactMode, themeColor]);

  // Listen to external/cross-tab or layout changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const nextScheme = e.newValue as ColorScheme;
        if (nextScheme === "light" || nextScheme === "dark" || nextScheme === "system") {
          setColorSchemeState(nextScheme);
        }
      } else if (e.key === THEME_COLOR_STORAGE_KEY && e.newValue) {
        const nextColor = e.newValue as ThemeColor;
        if (THEME_COLOR_OPTIONS.some((o) => o.id === nextColor)) {
          setThemeColorState(nextColor);
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
        themeColor?: ThemeColor;
        compactMode?: boolean;
        sidebarCollapsed?: boolean;
      }>;
      if (custom.detail) {
        if (custom.detail.colorScheme) setColorSchemeState(custom.detail.colorScheme);
        if (custom.detail.themeColor) setThemeColorState(custom.detail.themeColor);
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
    const effective = applyAppearanceToDOM(nextScheme, compactMode, themeColor);
    setResolvedTheme(effective);
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_EVENT, { detail: { colorScheme: nextScheme } })
    );
  }, [compactMode, themeColor]);

  const setThemeColor = useCallback((nextColor: ThemeColor) => {
    setThemeColorState(nextColor);
    try {
      localStorage.setItem(THEME_COLOR_STORAGE_KEY, nextColor);
    } catch {}
    applyAppearanceToDOM(colorScheme, compactMode, nextColor);
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_EVENT, { detail: { themeColor: nextColor } })
    );
  }, [colorScheme, compactMode]);

  const setCompactMode = useCallback((nextCompact: boolean) => {
    setCompactModeState(nextCompact);
    try {
      localStorage.setItem(COMPACT_STORAGE_KEY, String(nextCompact));
    } catch {}
    applyAppearanceToDOM(colorScheme, nextCompact, themeColor);
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_EVENT, { detail: { compactMode: nextCompact } })
    );
  }, [colorScheme, themeColor]);

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
    setThemeColor("emerald");
    setCompactMode(false);
    setSidebarCollapsed(false);
  }, [setColorScheme, setThemeColor, setCompactMode, setSidebarCollapsed]);

  return {
    colorScheme,
    setColorScheme,
    themeColor,
    setThemeColor,
    compactMode,
    setCompactMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    resolvedTheme,
    resetToDefaults,
  };
}
