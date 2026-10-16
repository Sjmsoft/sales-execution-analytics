import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

/** Minimum time (ms) the branded loader stays visible once it appears. */
export const DEFAULT_MIN_LOADER_MS = 900;

/**
 * Keeps a loading flag "on" for at least `minMs` after it last turned on,
 * so the logo loader is always visible briefly instead of flashing.
 */
export function useMinimumLoading(
  active: boolean,
  minMs: number = DEFAULT_MIN_LOADER_MS,
): boolean {
  // Each time `active` flips to true a new loading "cycle" begins.
  const [cycle, setCycle] = useState(active ? 1 : 0);
  const [prevActive, setPrevActive] = useState(active);
  const [completedCycle, setCompletedCycle] = useState(0);

  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setCycle((c) => c + 1);
  }

  useEffect(() => {
    if (cycle === 0) return;
    const timer = window.setTimeout(() => setCompletedCycle(cycle), minMs);
    return () => window.clearTimeout(timer);
  }, [cycle, minMs]);

  return active || completedCycle < cycle;
}

/**
 * Drop-in replacement for `useState<boolean>` used for data-loading flags.
 * The returned value honours a minimum visible duration for the loader.
 */
export function useLoaderState(
  initial: boolean,
  minMs: number = DEFAULT_MIN_LOADER_MS,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [loading, setLoading] = useState(initial);
  const visible = useMinimumLoading(loading, minMs);
  return [visible, setLoading];
}
