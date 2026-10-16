import { supabase } from "../lib/supabase";

export type VisitOutcomeItem = {
  id: string;
  name: string;
  key: string;
  color: string;
  color_name?: string;
  description?: string;
  sort_order?: number;
  is_active: boolean;
  created_at?: string;
};

export const COLOR_OPTIONS = [
  { hex: "#10B981", name: "Green" },
  { hex: "#F59E0B", name: "Amber" },
  { hex: "#3B82F6", name: "Blue" },
  { hex: "#EF4444", name: "Red" },
];

export const DEFAULT_VISIT_OUTCOMES: VisitOutcomeItem[] = [
  {
    id: "vo-01",
    name: "Successful",
    key: "successful",
    color: "#10B981",
    color_name: "Green",
    description: "Visit completed successfully with sales or positive engagement",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "vo-02",
    name: "Partial",
    key: "partial",
    color: "#F59E0B",
    color_name: "Amber",
    description: "Visit partially completed or partially successful",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "vo-03",
    name: "Pending",
    key: "pending",
    color: "#3B82F6",
    color_name: "Blue",
    description: "Visit pending follow-up action or decision",
    sort_order: 3,
    is_active: true,
  },
];

const STORAGE_KEY_VISIT_OUTCOMES = "penedge_configured_visit_outcomes_v1";

/**
 * Reads all configured visit outcomes from local cache / Supabase table `visit_outcomes`.
 */
export async function getVisitOutcomes(): Promise<VisitOutcomeItem[]> {
  let cached: VisitOutcomeItem[] | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISIT_OUTCOMES);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("localStorage visit outcomes read error:", e);
  }

  // Try fetching from Supabase 'visit_outcomes' table
  try {
    const { data, error } = await supabase
      .from("visit_outcomes")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      const remote: VisitOutcomeItem[] = data.map((t: any, idx: number) => {
        const colorHex = t.color || "#10B981";
        const matchedColor = COLOR_OPTIONS.find((c) => c.hex.toLowerCase() === colorHex.toLowerCase());
        return {
          id: String(t.id || `vo-${t.key || idx + 1}`),
          name: t.name || t.outcome_name || "Unnamed Outcome",
          key: t.key || t.outcome_key || t.name?.toLowerCase().replace(/\s+/g, "_") || `vo_${idx}`,
          color: colorHex,
          color_name: t.color_name || matchedColor?.name || "Green",
          description: t.description || "",
          sort_order: t.sort_order ?? idx + 1,
          is_active: t.is_active ?? true,
          created_at: t.created_at,
        };
      });

      // Merge: remote updates + any local-only items
      let merged = [...remote];
      if (cached && cached.length > 0) {
        for (const localItem of cached) {
          if (!merged.some((r) => r.id === localItem.id || r.key === localItem.key)) {
            merged.push(localItem);
          }
        }
      }

      merged.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
      localStorage.setItem(STORAGE_KEY_VISIT_OUTCOMES, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("Supabase visit_outcomes fetch notice:", err);
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  // Fallback to defaults
  localStorage.setItem(STORAGE_KEY_VISIT_OUTCOMES, JSON.stringify(DEFAULT_VISIT_OUTCOMES));
  return DEFAULT_VISIT_OUTCOMES;
}

/**
 * Saves (creates or updates) a visit outcome item.
 */
export async function saveVisitOutcome(
  item: Partial<VisitOutcomeItem> & { name: string }
): Promise<{ success: boolean; data?: VisitOutcomeItem; message?: string }> {
  const current = await getVisitOutcomes();

  const name = item.name.trim();
  if (!name) {
    return { success: false, message: "Outcome name is required." };
  }

  const generatedKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const key = item.key?.trim().toLowerCase() || generatedKey || `vo_${Date.now()}`;
  const id = item.id || `vo-${Date.now()}`;

  // Validate duplicate
  const duplicate = current.find(
    (t) => t.id !== id && (t.name.toLowerCase() === name.toLowerCase() || t.key === key)
  );
  if (duplicate) {
    return {
      success: false,
      message: `A visit outcome with name "${name}" already exists.`,
    };
  }

  const colorHex = item.color || "#10B981";
  const matchedColor = COLOR_OPTIONS.find((c) => c.hex.toLowerCase() === colorHex.toLowerCase());

  const newItem: VisitOutcomeItem = {
    id,
    name,
    key,
    color: colorHex,
    color_name: item.color_name || matchedColor?.name || "Green",
    description: item.description?.trim() || "",
    sort_order: item.sort_order ?? (current.length + 1),
    is_active: item.is_active ?? true,
    created_at: item.created_at || new Date().toISOString(),
  };

  const exists = current.some((t) => t.id === id);
  const updatedList = exists
    ? current.map((t) => (t.id === id ? newItem : t))
    : [...current, newItem];

  updatedList.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));

  // 1. Save to local storage
  try {
    localStorage.setItem(STORAGE_KEY_VISIT_OUTCOMES, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("localStorage visit outcome save error:", e);
  }

  // 2. Attempt Supabase write
  try {
    await supabase.from("visit_outcomes").upsert(
      {
        id: newItem.id,
        name: newItem.name,
        key: newItem.key,
        color: newItem.color,
        color_name: newItem.color_name,
        description: newItem.description,
        sort_order: newItem.sort_order,
        is_active: newItem.is_active,
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.warn("Supabase visit_outcomes save notice:", err);
  }

  return { success: true, data: newItem };
}

/**
 * Deletes a visit outcome.
 */
export async function deleteVisitOutcome(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const current = await getVisitOutcomes();
  const updatedList = current.filter((t) => t.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY_VISIT_OUTCOMES, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("localStorage visit outcome delete error:", e);
  }

  try {
    await supabase.from("visit_outcomes").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase visit_outcomes delete notice:", err);
  }

  return { success: true };
}
