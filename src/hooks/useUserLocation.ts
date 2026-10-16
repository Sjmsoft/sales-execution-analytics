import { useState, useEffect, useCallback } from "react";
import { getCurrentPosition, formatGpsError } from "../pages/visits/visitsUtils";

export type UserLiveLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  label?: string;
};

const STORAGE_KEY_PREFIX = "penedge_user_live_coords";

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

  const recalibrate = useCallback(
    async (options?: { timeoutMs?: number; forceStandard?: boolean }): Promise<UserLiveLocation | null> => {
      setIsLocating(true);
      setLocationError(null);

      try {
        const pos = await getCurrentPosition({
          timeoutMs: options?.timeoutMs ?? 10000,
          forceStandard: options?.forceStandard ?? false,
          maximumAgeMs: 0,
        });

        const liveData: UserLiveLocation = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
          timestamp: pos.timestamp || Date.now(),
          label: "Your Current Physical Location",
        };

        setUserLocation(liveData);
        setLastCalibratedAt(new Date());

        try {
          const serialized = JSON.stringify(liveData);
          localStorage.setItem(STORAGE_KEY_PREFIX, serialized);
          if (userId) {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}_${userId}`, serialized);
          }
        } catch {
          // Ignore storage issues
        }

        return liveData;
      } catch (err: unknown) {
        const msg = formatGpsError(err);
        setLocationError(msg);
        console.warn("Unable to acquire live user location:", err);
        return null;
      } finally {
        setIsLocating(false);
      }
    },
    [userId]
  );

  // Auto-acquire current location upon mount / when user signs in
  useEffect(() => {
    let isMounted = true;

    async function autoAcquire() {
      // If we don't have userLocation or cached location is older than 5 minutes, auto-recalibrate
      const isStale = !userLocation || Date.now() - userLocation.timestamp > 5 * 60 * 1000;
      if (isStale) {
        setIsLocating(true);
        try {
          const pos = await getCurrentPosition({ timeoutMs: 9000, maximumAgeMs: 30000 });
          if (!isMounted) return;
          const liveData: UserLiveLocation = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
            timestamp: pos.timestamp || Date.now(),
            label: "Your Current Physical Location",
          };
          setUserLocation(liveData);
          setLastCalibratedAt(new Date());

          try {
            const serialized = JSON.stringify(liveData);
            localStorage.setItem(STORAGE_KEY_PREFIX, serialized);
            if (userId) {
              localStorage.setItem(`${STORAGE_KEY_PREFIX}_${userId}`, serialized);
            }
          } catch {
            // Ignore storage issues
          }
        } catch (err: unknown) {
          if (!isMounted) return;
          setLocationError(formatGpsError(err));
        } finally {
          if (isMounted) setIsLocating(false);
        }
      }
    }

    void autoAcquire();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return {
    userLocation,
    isLocating,
    locationError,
    lastCalibratedAt,
    recalibrate,
  };
}
