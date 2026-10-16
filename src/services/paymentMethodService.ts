import { supabase } from "../lib/supabase";

export type PaymentMethodItem = {
  id: string;
  name: string;
  key: string;
  description?: string;
  sort_order?: number;
  is_active: boolean;
  created_at?: string;
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
  {
    id: "pm-01",
    name: "Cheque",
    key: "cheque",
    description: "Cheque payments",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "pm-02",
    name: "Bank transfer",
    key: "bank_transfer",
    description: "Direct electronic bank transfer",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "pm-03",
    name: "Cash",
    key: "cash",
    description: "Physical cash transactions",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "pm-04",
    name: "POS",
    key: "pos",
    description: "Point of sale card transactions",
    sort_order: 3,
    is_active: true,
  },
];

const STORAGE_KEY_PAYMENT_METHODS = "penedge_configured_payment_methods_v1";

/**
 * Reads all configured payment methods from local storage and Supabase table `payment_methods`.
 */
export async function getPaymentMethods(): Promise<PaymentMethodItem[]> {
  let cached: PaymentMethodItem[] | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAYMENT_METHODS);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("localStorage payment methods read error:", e);
  }

  // Try fetching from Supabase 'payment_methods' table
  try {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      const remote: PaymentMethodItem[] = data.map((t: any, idx: number) => ({
        id: String(t.id || `pm-${t.key || idx + 1}`),
        name: t.name || t.method_name || "Unnamed Method",
        key: t.key || t.method_key || t.name?.toLowerCase().replace(/\s+/g, "_") || `pm_${idx}`,
        description: t.description || "",
        sort_order: t.sort_order ?? idx + 1,
        is_active: t.is_active ?? true,
        created_at: t.created_at,
      }));

      // Merge: remote updates + any local-only methods
      let merged = [...remote];
      if (cached && cached.length > 0) {
        for (const localItem of cached) {
          if (!merged.some((r) => r.id === localItem.id || r.key === localItem.key)) {
            merged.push(localItem);
          }
        }
      }

      merged.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
      localStorage.setItem(STORAGE_KEY_PAYMENT_METHODS, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("Supabase payment_methods fetch notice:", err);
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  // Fallback to defaults
  localStorage.setItem(STORAGE_KEY_PAYMENT_METHODS, JSON.stringify(DEFAULT_PAYMENT_METHODS));
  return DEFAULT_PAYMENT_METHODS;
}

/**
 * Saves (creates or updates) a payment method.
 */
export async function savePaymentMethod(
  item: Partial<PaymentMethodItem> & { name: string }
): Promise<{ success: boolean; data?: PaymentMethodItem; message?: string }> {
  const current = await getPaymentMethods();

  const name = item.name.trim();
  if (!name) {
    return { success: false, message: "Method name is required." };
  }

  const generatedKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const key = item.key?.trim().toLowerCase() || generatedKey || `pm_${Date.now()}`;
  const id = item.id || `pm-${Date.now()}`;

  // Validate duplicate
  const duplicate = current.find(
    (t) => t.id !== id && (t.name.toLowerCase() === name.toLowerCase() || t.key === key)
  );
  if (duplicate) {
    return {
      success: false,
      message: `A payment method with name "${name}" already exists.`,
    };
  }

  const newItem: PaymentMethodItem = {
    id,
    name,
    key,
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
    localStorage.setItem(STORAGE_KEY_PAYMENT_METHODS, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("localStorage payment method save error:", e);
  }

  // 2. Attempt Supabase write
  try {
    await supabase.from("payment_methods").upsert(
      {
        id: newItem.id,
        name: newItem.name,
        key: newItem.key,
        description: newItem.description,
        sort_order: newItem.sort_order,
        is_active: newItem.is_active,
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.warn("Supabase payment_methods save notice:", err);
  }

  return { success: true, data: newItem };
}

/**
 * Deletes a payment method.
 */
export async function deletePaymentMethod(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const current = await getPaymentMethods();
  const updatedList = current.filter((t) => t.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY_PAYMENT_METHODS, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("localStorage payment method delete error:", e);
  }

  try {
    await supabase.from("payment_methods").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase payment_methods delete notice:", err);
  }

  return { success: true };
}
