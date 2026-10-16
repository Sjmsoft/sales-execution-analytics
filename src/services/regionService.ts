import { supabase } from "../lib/supabase";

export type RegionItem = {
  id: string;
  name: string;
  code: string;
  state: string;
  description: string;
  is_active: boolean;
  created_at?: string;
};

export const DEFAULT_SYSTEM_REGIONS: RegionItem[] = [
  {
    id: "reg-01",
    name: "Portharcourt - South",
    code: "P.H",
    state: "Rivers",
    description: "South-South regional sales & distribution territory.",
    is_active: true,
  },
  {
    id: "reg-02",
    name: "Abuja - North",
    code: "ABJ",
    state: "FCT",
    description: "Federal Capital Territory & Northern sales hub.",
    is_active: true,
  },
  {
    id: "reg-03",
    name: "Lagos mainland",
    code: "LM",
    state: "Lagos State",
    description: "Mainland key accounts & distributor network.",
    is_active: true,
  },
  {
    id: "reg-04",
    name: "Anambra",
    code: "AWKA",
    state: "Anambra",
    description: "South-East commercial and retail sales zone.",
    is_active: true,
  },
  {
    id: "reg-05",
    name: "Lagos Island",
    code: "LS",
    state: "Lagos State",
    description: "On-trade high-end outlets and luxury venues.",
    is_active: true,
  },
  {
    id: "reg-06",
    name: "Enugu- East",
    code: "EGU",
    state: "Enugu",
    description: "Eastern regional distribution network.",
    is_active: true,
  },
  {
    id: "reg-07",
    name: "Edo Region",
    code: "EDO",
    state: "Edo",
    description: "Mid-Western sales territory.",
    is_active: true,
  },
  {
    id: "reg-08",
    name: "Victoria Island",
    code: "VI",
    state: "Lagos State",
    description: "Premium lounge and hotel outlet accounts.",
    is_active: true,
  },
  {
    id: "reg-09",
    name: "Ikeja",
    code: "IKJ",
    state: "Lagos State",
    description: "Central industrial & hospitality sales zone.",
    is_active: true,
  },
  {
    id: "reg-10",
    name: "Lekki",
    code: "LEK",
    state: "Lagos State",
    description: "Lekki peninsula outlet network.",
    is_active: true,
  },
  {
    id: "reg-11",
    name: "Surulere",
    code: "SUR",
    state: "Lagos State",
    description: "Urban trade retail outlets.",
    is_active: true,
  },
  {
    id: "reg-12",
    name: "Ibadan",
    code: "IBD",
    state: "Oyo",
    description: "South-Western regional distribution Hub.",
    is_active: true,
  },
];

const STORAGE_KEY_REGIONS = "penedge_configured_regions_v1";

function inferRegionDetails(name: string): { code: string; state: string } {
  const n = name.trim().toLowerCase();
  if (
    n.includes("lagos") ||
    n.includes("ikeja") ||
    n.includes("lekki") ||
    n.includes("surulere") ||
    n.includes("victoria")
  ) {
    return { code: name.substring(0, 3).toUpperCase(), state: "Lagos State" };
  }
  if (n.includes("portharcourt") || n.includes("port harcourt")) {
    return { code: "PH", state: "Rivers" };
  }
  if (n.includes("abuja")) {
    return { code: "ABJ", state: "FCT" };
  }
  if (n.includes("anambra") || n.includes("awka")) {
    return { code: "ANM", state: "Anambra" };
  }
  if (n.includes("enugu")) {
    return { code: "EGU", state: "Enugu" };
  }
  if (n.includes("edo") || n.includes("benin")) {
    return { code: "EDO", state: "Edo" };
  }
  if (n.includes("ibadan") || n.includes("oyo")) {
    return { code: "IBD", state: "Oyo" };
  }
  return { code: name.substring(0, 3).toUpperCase() || "REG", state: name };
}

/**
 * Loads all configured regions dynamically derived from live Supabase staff assignments
 * and custom configured regions in localStorage.
 */
export async function getRegions(): Promise<RegionItem[]> {
  let cached: RegionItem[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cached = parsed;
    }
  } catch (e) {
    console.warn("localStorage regions read error:", e);
  }

  // Discover live regions from Supabase 'staff' table
  const discoveredNames = new Set<string>();
  try {
    const { data: staffData } = await supabase
      .from("staff")
      .select("region, assigned_regions");

    if (staffData) {
      for (const s of staffData) {
        if (s.region && typeof s.region === "string" && s.region.trim()) {
          discoveredNames.add(s.region.trim());
        }
        if (Array.isArray(s.assigned_regions)) {
          for (const r of s.assigned_regions) {
            if (r && typeof r === "string" && r.trim()) {
              discoveredNames.add(r.trim());
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Supabase staff regions discovery notice:", err);
  }

  // Also discover regions from 'outlets' table
  try {
    const { data: outletsData } = await supabase
      .from("outlets")
      .select("state");
    if (outletsData) {
      for (const o of outletsData) {
        if (o.state && typeof o.state === "string" && o.state.trim()) {
          discoveredNames.add(o.state.trim());
        }
      }
    }
  } catch { }

  const regionMap = new Map<string, RegionItem>();

  // Add default system regions as base
  for (const def of DEFAULT_SYSTEM_REGIONS) {
    regionMap.set(def.name.toLowerCase(), def);
  }

  // Merge discovered live regions from Supabase
  for (const name of discoveredNames) {
    const key = name.toLowerCase();
    if (!regionMap.has(key)) {
      const details = inferRegionDetails(name);
      regionMap.set(key, {
        id: `reg-${details.code.toLowerCase()}-${Date.now()}`,
        name,
        code: details.code,
        state: details.state,
        description: `Operational territory for ${name}.`,
        is_active: true,
      });
    }
  }

  // Merge cached custom updates
  for (const c of cached) {
    regionMap.set(c.name.toLowerCase(), c);
  }

  const result = Array.from(regionMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return result;
}

/**
 * Saves (creates or updates) a region item.
 */
export async function saveRegion(
  region: RegionItem
): Promise<{ success: boolean; region: RegionItem; message: string }> {
  try {
    const payload: RegionItem = {
      ...region,
      id: region.id || `reg-${Date.now()}`,
      name: region.name.trim(),
      code: region.code.trim().toUpperCase(),
      state: region.state.trim() || "N/A",
      description: region.description.trim() || "-",
      is_active: region.is_active ?? true,
    };

    // Save to localStorage
    const current = await getRegions();
    const idx = current.findIndex((r) => r.id === payload.id || r.name.toLowerCase() === payload.name.toLowerCase());
    if (idx >= 0) {
      current[idx] = payload;
    } else {
      current.push(payload);
    }
    localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(current));

    return {
      success: true,
      region: payload,
      message: `Region "${payload.name}" saved successfully.`,
    };
  } catch (err: any) {
    return {
      success: false,
      region,
      message: err?.message || "Failed to save region.",
    };
  }
}

/**
 * Checks if a region has child dependencies (assigned staff members or outlets).
 * Returns details on child entities to show exact error message to user.
 */
export async function checkRegionChildDependencies(
  regionName: string,
  regionId: string
): Promise<{ hasChildren: boolean; staffCount: number; outletCount: number; staffNames: string[]; message: string }> {
  let staffCount = 0;
  let outletCount = 0;
  const staffNames: string[] = [];

  const searchName = regionName.toLowerCase();

  // 1. Check assigned staff in 'staff' table
  try {
    const { data: staffData } = await supabase.from("staff").select("id, name, region, assigned_regions");
    if (staffData) {
      for (const s of staffData) {
        const primaryReg = (s.region || "").toLowerCase();
        const assignedRegs = Array.isArray(s.assigned_regions)
          ? s.assigned_regions.map((r: string) => r.toLowerCase())
          : [];

        if (primaryReg === searchName || assignedRegs.includes(searchName)) {
          staffCount++;
          if (staffNames.length < 3) {
            staffNames.push(s.name || "Staff Member");
          }
        }
      }
    }
  } catch (e) {
    console.warn("Staff region child check notice:", e);
  }

  // 2. Check linked outlets in 'outlets' table
  try {
    const { data: outletsData } = await supabase.from("outlets").select("id, name, region_id, state");
    if (outletsData) {
      for (const o of outletsData) {
        if (o.region_id === regionId || (o.state && o.state.toLowerCase() === searchName)) {
          outletCount++;
        }
      }
    }
  } catch (e) {
    console.warn("Outlets region child check notice:", e);
  }

  const hasChildren = staffCount > 0 || outletCount > 0;
  let message = "";

  if (hasChildren) {
    const parts: string[] = [];
    if (staffCount > 0) {
      parts.push(`${staffCount} staff member${staffCount > 1 ? "s" : ""} (${staffNames.join(", ")}${staffCount > 3 ? "..." : ""})`);
    }
    if (outletCount > 0) {
      parts.push(`${outletCount} retail outlet${outletCount > 1 ? "s" : ""}`);
    }

    message = `Cannot delete region "${regionName}" because it has child dependencies: ${parts.join(" and ")} currently linked to it. Please reassign or remove these child entities first.`;
  }

  return {
    hasChildren,
    staffCount,
    outletCount,
    staffNames,
    message,
  };
}

/**
 * Deletes a region if it has no child dependencies.
 */
export async function deleteRegion(
  regionId: string,
  regionName: string
): Promise<{ success: boolean; message: string }> {
  // Verify child dependencies first
  const check = await checkRegionChildDependencies(regionName, regionId);
  if (check.hasChildren) {
    return {
      success: false,
      message: check.message,
    };
  }

  try {
    // Delete from localStorage
    const current = await getRegions();
    const filtered = current.filter((r) => r.id !== regionId && r.name.toLowerCase() !== regionName.toLowerCase());
    localStorage.setItem(STORAGE_KEY_REGIONS, JSON.stringify(filtered));

    return {
      success: true,
      message: `Region "${regionName}" deleted successfully.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to delete region.",
    };
  }
}
