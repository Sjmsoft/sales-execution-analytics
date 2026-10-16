import { supabase } from "../lib/supabase";

export type OutletTypeItem = {
  id: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  sort_order?: number;
  is_active: boolean;
  created_at?: string;
};

export const DEFAULT_OUTLET_TYPES: OutletTypeItem[] = [
  {
    id: "type-01",
    name: "ON-TRADE",
    key: "on-trade",
    description: "On-premise consumption venues (Bar, Restaurant, Hotel, Club)",
    color: "#E91E63",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "type-02",
    name: "OFF-TRADE",
    key: "off-trade",
    description: "Off-premise retail stores (Supermarket, Liquor Store, Grocery)",
    color: "#7C3AED",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "type-03",
    name: "KEY ACCOUNT",
    key: "key_account",
    description: "Strategic high-volume key accounts & chain stores",
    color: "#D946EF",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "type-04",
    name: "Modern Trade",
    key: "mt",
    description: "Modern retail chains & hypermarkets",
    color: "#EC4899",
    sort_order: 4,
    is_active: true,
  },
];

const STORAGE_KEY_OUTLET_TYPES = "penedge_configured_outlet_types_v1";

/**
 * Gets all configured outlet types from local cache / Supabase.
 */
export async function getOutletTypes(): Promise<OutletTypeItem[]> {
  let cached: OutletTypeItem[] | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OUTLET_TYPES);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("localStorage outlet types read error:", e);
  }

  // Try fetching from Supabase 'outlet_types' table
  try {
    const { data, error } = await supabase
      .from("outlet_types")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      const remote: OutletTypeItem[] = data.map((t: any, idx: number) => ({
        id: t.id || `type-${t.key || idx + 1}`,
        name: t.name || t.type_name || "Unnamed Type",
        key: t.key || t.type_key || t.name?.toLowerCase().replace(/\s+/g, "_") || `type_${idx}`,
        description: t.description || "",
        color: t.color || "#075544",
        sort_order: t.sort_order ?? idx + 1,
        is_active: t.is_active ?? true,
        created_at: t.created_at,
      }));
      // Update cache
      localStorage.setItem(STORAGE_KEY_OUTLET_TYPES, JSON.stringify(remote));
      return remote;
    }
  } catch (err) {
    console.warn("Supabase outlet_types fetch notice:", err);
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  // Fallback to default outlet types
  localStorage.setItem(STORAGE_KEY_OUTLET_TYPES, JSON.stringify(DEFAULT_OUTLET_TYPES));
  return DEFAULT_OUTLET_TYPES;
}

/**
 * Saves (creates or updates) an outlet type in local cache and Supabase.
 */
export async function saveOutletType(
  item: Partial<OutletTypeItem> & { name: string; key: string }
): Promise<{ success: boolean; data?: OutletTypeItem; message?: string }> {
  const current = await getOutletTypes();

  const id = item.id || `type-${Date.now()}`;
  const key = item.key.trim().toLowerCase().replace(/\s+/g, "_");
  const name = item.name.trim();

  // Validate duplicate key
  const duplicate = current.find(
    (t) => t.id !== id && (t.key === key || t.name.toLowerCase() === name.toLowerCase())
  );
  if (duplicate) {
    return {
      success: false,
      message: `An outlet type with key "${key}" or name "${name}" already exists.`,
    };
  }

  const newItem: OutletTypeItem = {
    id,
    name,
    key,
    description: item.description?.trim() || "",
    color: item.color || "#E91E63",
    sort_order: item.sort_order ?? current.length + 1,
    is_active: item.is_active ?? true,
    created_at: item.created_at || new Date().toISOString(),
  };

  const updatedList = item.id
    ? current.map((t) => (t.id === id ? newItem : t))
    : [...current, newItem];

  // Save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY_OUTLET_TYPES, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("localStorage save error:", e);
  }

  // Attempt Supabase upsert
  try {
    await supabase.from("outlet_types").upsert(
      {
        id: newItem.id,
        name: newItem.name,
        key: newItem.key,
        description: newItem.description,
        color: newItem.color,
        sort_order: newItem.sort_order,
        is_active: newItem.is_active,
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.warn("Supabase outlet_types save notice:", err);
  }

  return { success: true, data: newItem };
}

/**
 * Deletes an outlet type.
 */
export async function deleteOutletType(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const current = await getOutletTypes();
  const updatedList = current.filter((t) => t.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY_OUTLET_TYPES, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("localStorage delete error:", e);
  }

  try {
    await supabase.from("outlet_types").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase outlet_types delete notice:", err);
  }

  return { success: true };
}
