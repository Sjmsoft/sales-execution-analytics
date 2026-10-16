/** Pure, reusable helpers for the Visits feature. */

export const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });

export const parseDate = (value: string) => new Date(`${value}T12:00:00`);

export const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayIsoDate = () => toIsoDate(new Date());

export const formatCheckIn = (checkInAt: string) => ({
  date: new Date(checkInAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
  time: new Date(checkInAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }),
});

export const minutesSince = (isoTime: string) =>
  Math.max(1, Math.round((Date.now() - new Date(isoTime).getTime()) / 60000));

/** Great-circle distance in metres between two coordinates (haversine). */
export function distanceInMeters(
  from: { latitude: number | string; longitude: number | string },
  to: { latitude: number | string; longitude: number | string },
): number {
  const fromLat = Number(from.latitude);
  const fromLng = Number(from.longitude);
  const toLat = Number(to.latitude);
  const toLng = Number(to.longitude);

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    return Infinity;
  }

  const EARTH_RADIUS = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(toLat - fromLat);
  const longitudeDelta = toRadians(toLng - fromLng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

/**
 * Default base geofence radius in meters.
 * 500m provides an industry-standard perimeter for retail outlets, malls,
 * supermarkets, open plazas, and commercial centers with indoor GPS attenuation.
 */
export const DEFAULT_ALLOWED_GPS_DISTANCE = 500;

export function formatDistance(meters: number): string {
  if (meters <= 15) {
    return "On Site (< 15m)";
  }
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * Calculates allowable check-in distance for an outlet in meters.
 * Combines base geofence allowance with outlet registration accuracy and device GPS precision.
 */
export const allowedGpsDistance = (
  registrationAccuracyMeters?: number | null,
  deviceAccuracyMeters?: number | null,
): number => {
  const regAcc =
    registrationAccuracyMeters != null && !isNaN(Number(registrationAccuracyMeters))
      ? Math.max(0, Number(registrationAccuracyMeters))
      : 0;

  const baseAllowed = Math.max(DEFAULT_ALLOWED_GPS_DISTANCE, regAcc);

  const devAcc =
    deviceAccuracyMeters != null && !isNaN(Number(deviceAccuracyMeters))
      ? Math.min(Math.max(0, Number(deviceAccuracyMeters)), 500)
      : 0;

  return Math.round(baseAllowed + devAcc);
};

export const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

export const VISIT_OUTCOMES = ["Successful", "Partial", "Pending"] as const;

/** Acquire device geolocation with high-accuracy, smart fallback, and sensor stabilization */
export function getCurrentPosition(options?: {
  forceStandard?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    const highTimeout = options?.timeoutMs ?? 15000;
    const standardTimeout = 12000;
    // Default to 5000ms cache window to avoid hardware sensor thrashing and cold jitter, unless explicitly forced to 0
    const maxAge = options?.maximumAgeMs !== undefined ? options.maximumAgeMs : 5000;

    if (options?.forceStandard) {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: standardTimeout,
        maximumAge: maxAge,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        // If high accuracy times out or position is unavailable, automatically try standard/network accuracy fallback
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: standardTimeout,
            maximumAge: maxAge > 0 ? maxAge : 10000,
          });
        } else {
          reject(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: highTimeout,
        maximumAge: maxAge,
      }
    );
  });
}

/** User-friendly GPS error messaging */
export function formatGpsError(err: unknown): string {
  const maybeGeo = err as { code?: number; message?: string } | null;
  if (maybeGeo && typeof maybeGeo.code === "number") {
    if (maybeGeo.code === 1) {
      return "Location permission denied. Please allow GPS / location access in your browser or device settings.";
    }
    if (maybeGeo.code === 2) {
      return "GPS location is currently unavailable. Please verify device location services are turned on.";
    }
    if (maybeGeo.code === 3) {
      return "GPS signal timed out. Device could not acquire a satellite fix. Try moving closer to an open area or enable Wi-Fi.";
    }
  }
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("timeout")) {
      return "GPS signal timed out. Device could not acquire a satellite fix. Try moving closer to an open area or enable Wi-Fi.";
    }
    return err.message;
  }
  return "Unable to verify GPS location. Please try again or verify your device location.";
}

/** Check if an outlet has valid registered GPS coordinates */
export function hasValidOutletCoords(outlet: {
  gpslatitude?: number | string | null;
  gpslongitude?: number | string | null;
} | null | undefined): boolean {
  if (!outlet) return false;
  const lat = Number(outlet.gpslatitude);
  const lng = Number(outlet.gpslongitude);
  return (
    outlet.gpslatitude !== null &&
    outlet.gpslatitude !== undefined &&
    outlet.gpslatitude !== "" &&
    !isNaN(lat) &&
    outlet.gpslongitude !== null &&
    outlet.gpslongitude !== undefined &&
    outlet.gpslongitude !== "" &&
    !isNaN(lng) &&
    // Guard against uncalibrated (0,0) coordinates
    (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)
  );
}

export type LocationVerificationResult = {
  verified: boolean;
  distance: number;
  allowedDistance: number;
  deviceAccuracy: number | null;
  outletCoords: { latitude: number; longitude: number } | null;
  userCoords: { latitude: number; longitude: number };
  isTestOutlet?: boolean;
  error?: string;
};

/** Verifies distance between logged-in user's current coordinates and target outlet GPS */
export function verifyOutletLocation(
  currentCoords: { latitude: number; longitude: number; accuracy?: number | null },
  outlet: {
    name: string;
    gpslatitude: number | null;
    gpslongitude: number | null;
    registrationaccuracymeters?: number | null;
  }
): LocationVerificationResult {
  const deviceAccuracy =
    currentCoords.accuracy != null && !isNaN(Number(currentCoords.accuracy))
      ? Number(currentCoords.accuracy)
      : null;

  const userCoords = {
    latitude: Number(currentCoords.latitude),
    longitude: Number(currentCoords.longitude),
  };

  const isTestOutlet =
    outlet.name.toLowerCase().includes("test") ||
    outlet.name.toLowerCase().includes("demo");

  if (!hasValidOutletCoords(outlet)) {
    return {
      verified: false,
      distance: 0,
      allowedDistance: DEFAULT_ALLOWED_GPS_DISTANCE,
      deviceAccuracy,
      outletCoords: null,
      userCoords,
      isTestOutlet,
      error: `Target outlet "${outlet.name}" does not have registered GPS coordinates in the system. Location proximity verification cannot match coordinates.`,
    };
  }

  const outletCoords = {
    latitude: Number(outlet.gpslatitude),
    longitude: Number(outlet.gpslongitude),
  };

  const distance = Math.round(distanceInMeters(userCoords, outletCoords));
  const allowedDistance = allowedGpsDistance(
    outlet.registrationaccuracymeters,
    deviceAccuracy
  );

  const isWithinGeofence = distance <= allowedDistance;

  if (!isWithinGeofence) {
    const formattedDistance = formatDistance(distance);
    return {
      verified: false,
      distance,
      allowedDistance,
      deviceAccuracy,
      outletCoords,
      userCoords,
      isTestOutlet,
      error: `Your current location is ${formattedDistance} from ${outlet.name}. Maximum allowable check-in proximity is ${allowedDistance}m.`,
    };
  }

  return {
    verified: true,
    distance,
    allowedDistance,
    deviceAccuracy,
    outletCoords,
    userCoords,
    isTestOutlet,
  };
}

/** Aggregate metrics derived from a list of visits. */
export function visitMetrics(visits: { outcome: string; gps: boolean }[]) {
  const successful = visits.filter((visit) => visit.outcome === "Successful").length;
  const withGps = visits.filter((visit) => visit.gps).length;
  const total = visits.length;
  return {
    total,
    successful,
    pendingOrPartial: total - successful,
    successRate: total ? Math.round((successful / total) * 100) : 0,
    gpsRate: total ? Math.round((withGps / total) * 100) : 0,
    withGps,
  };
}
