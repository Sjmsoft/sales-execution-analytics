import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentPosition, formatGpsError, distanceInMeters } from "../pages/visits/visitsUtils";

export type UserLiveLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  label?: string;
};

const STORAGE_KEY_PREFIX = "penedge_user_live_coords";

// In-flight deduplication across concurrent callers
let inFlightLocationPromise: Promise<UserLiveLocation | null> | null = null;

/**
 * Filter and stabilize GPS coordinates against sensor micro-jitter and cell-tower bouncing.
 * If user has moved < 15m (stationary), damp jitter with an exponential moving average.
 * If candidate reading has degraded accuracy, reject it in favor of known satellite lock.
 */
export function stabilizeUserLocation(
  current: UserLiveLocation | null,
  candidate: UserLiveLocation
): UserLiveLocation {
  if (!current) {
    return candidate;
  }

  const distMeters = distanceInMeters(
    { latitude: current.latitude, longitude: current.longitude },
    { latitude: candidate.latitude, longitude: candidate.longitude }
  );

  // 1. Accuracy degradation guard: Reject low-accuracy jumps (e.g. WiFi/cell tower fallback)
  // when an established high-accuracy satellite fix is already locked
  if (
    current.accuracy !== null &&
    candidate.accuracy !== null &&
    candidate.accuracy > 40 &&
    candidate.accuracy > current.accuracy * 2 &&
    distMeters < candidate.accuracy
  ) {
    return {
      ...current,
      timestamp: candidate.timestamp,
    };
  }

  // 2. Stationary jitter damping: If device moved less than 15 meters, apply exponential moving
  // average to eliminate micro-fluctuations so distances and coordinates stay completely stable
  if (distMeters < 15) {
    const smoothedLat = Number((current.latitude * 0.85 + candidate.latitude * 0.15).toFixed(6));
    const smoothedLng = Number((current.longitude * 0.85 + candidate.longitude * 0.15).toFixed(6));
    const bestAcc =
      current.accuracy !== null && candidate.accuracy !== null
        ? Math.min(current.accuracy, candidate.accuracy)
        : candidate.accuracy ?? current.accuracy;

    return {
      latitude: smoothedLat,
      longitude: smoothedLng,
      accuracy: bestAcc,
      timestamp: candidate.timestamp,
      label: candidate.label || current.label,
    };
  }

  // 3. Genuine physical movement (> 15m): update to new coordinates
  return candidate;
}

export function useUserLocation(userId?: string | null) {
  const [userLocation, setUserLocation] = useState<UserLiveLocation | null>(() => {
    try {
      const storageKey = userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
      const cached = localStorage.getItem(storageKey) || localStorage.getItem(STORAGE_KEY_PREFIX);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  });

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCalibratedAt, setLastCalibratedAt] = useState<Date | null>(() => {
    return userLocation ? new Date(userLocation.timestamp) : null;
  });

  const userLocationRef = useRef<UserLiveLocation | null>(userLocation);
  userLocationRef.current = userLocation;

  const recalibrate = useCallback(
    async (options?: { timeoutMs?: number; forceStandard?: boolean; maximumAgeMs?: number }): Promise<UserLiveLocation | null> => {
      // If a geolocation acquisition is already in-flight, await the same promise to prevent hardware contention
      if (inFlightLocationPromise) {
        return inFlightLocationPromise;
      }

      setIsLocating(true);
      setLocationError(null);

      const acquisitionPromise = (async () => {
        try {
          const pos = await getCurrentPosition({
            timeoutMs: options?.timeoutMs ?? 10000,
            forceStandard: options?.forceStandard ?? false,
            maximumAgeMs: options?.maximumAgeMs ?? 3000,
          });

          const rawData: UserLiveLocation = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
            timestamp: pos.timestamp || Date.now(),
            label: "Your Current Physical Location",
          };

          // Apply sensor stabilization filter
          const stableData = stabilizeUserLocation(userLocationRef.current, rawData);

          setUserLocation(stableData);
          setLastCalibratedAt(new Date());

          try {
            const serialized = JSON.stringify(stableData);
            localStorage.setItem(STORAGE_KEY_PREFIX, serialized);
            if (userId) {
              localStorage.setItem(`${STORAGE_KEY_PREFIX}_${userId}`, serialized);
            }
          } catch {
            // Ignore storage issues
          }

          return stableData;
        } catch (err: unknown) {
          const msg = formatGpsError(err);
          setLocationError(msg);
          console.warn("Unable to acquire live user location:", err);
          return userLocationRef.current;
        } finally {
          setIsLocating(false);
          inFlightLocationPromise = null;
        }
      })();

      inFlightLocationPromise = acquisitionPromise;
      return acquisitionPromise;
    },
    [userId]
  );

  // Auto-acquire current location upon mount / when user signs in
  useEffect(() => {
    let isMounted = true;

    async function autoAcquire() {
      // If we don't have userLocation or cached location is older than 5 minutes, auto-recalibrate
      const isStale = !userLocationRef.current || Date.now() - userLocationRef.current.timestamp > 5 * 60 * 1000;
      if (isStale) {
        const result = await recalibrate({ timeoutMs: 9000, maximumAgeMs: 10000 });
        if (isMounted && !result && !userLocationRef.current) {
          // Keep existing or handle notice gracefully
        }
      }
    }

    void autoAcquire();

    return () => {
      isMounted = false;
    };
  }, [recalibrate]);

  return {
    userLocation,
    isLocating,
    locationError,
    lastCalibratedAt,
    recalibrate,
  };
}
