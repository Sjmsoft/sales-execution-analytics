import { supabase } from "../lib/supabase";

export type Sale = {
  id: string;
  created_at?: string | null;
  sale_date: string | null;
  quantity: number | null;
  unit_type: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance: number | null;
  payment_status: number | null;
  payment_method?: number | null;
  reference?: string | null;
  transaction_id?: string | null;
  staff: string | null;
  staff_id?: string | null;
  staff_role?: string | null;
  staff_region?: string | null;
  outlet: string | null;
  outlet_id?: string | null;
  outlet_region?: string | null;
  outlet_state?: string | null;
  drink_type: string | null;
  notes?: string | null;
  status?: string | null;
};

export const STORAGE_KEY_SALES = "penedge_configured_sales_v1";

export function getLocalSales(): Sale[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_SALES) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Local sales read error:", e);
  }
  return [];
}

export function saveLocalSales(sales: Sale[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
    }
  } catch (e) {
    console.error("Local sales save error:", e);
  }
}

export const STORAGE_KEY_PENDING_SALES = "penedge_pending_sales_v1";

export function getPendingSales(): any[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY_PENDING_SALES) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePendingSales(items: any[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PENDING_SALES, JSON.stringify(items));
    }
  } catch (e) {
    console.warn("savePendingSales notice:", e);
  }
}

let isSyncingSales = false;
export async function syncPendingSales(): Promise<void> {
  if (isSyncingSales || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  isSyncingSales = true;
  try {
    const pending = getPendingSales();
    if (pending.length === 0) return;

    const { error } = await supabase.from("sales").insert(pending).select();
    if (!error) {
      savePendingSales([]);
    } else {
      console.warn("syncPendingSales batch notice:", error);
    }
  } catch (err) {
    console.warn("syncPendingSales exception:", err);
  } finally {
    isSyncingSales = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncPendingSales();
  });
}

// Helpers for normalizing data types from the Supabase sales table
export function parseCurrencyNumber(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parsePaymentStatus(val: unknown): number {
  if (typeof val === "number") return val;
  const s = String(val ?? "").toLowerCase().trim();
  if (s === "paid" || s === "2") return 2;
  if (s === "partial" || s === "partially paid" || s === "1") return 1;
  return 0; // Unpaid / Pending / Credit
}

export function parseUnitType(val: unknown): number {
  if (typeof val === "number") return val;
  const s = String(val ?? "").toLowerCase().trim();
  if (s.includes("case") || s === "2") return 2;
  return 1; // Bottles
}

export function parseSaleDateToIso(raw: unknown): string {
  if (!raw) return "";
  const s = String(raw).trim();
  // Handle formats like "6/18/2026 0:00" or "6/18/2026"
  const datePart = s.split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length === 3) {
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return s;
}

export function parseTimestampToIso(raw: unknown): string {
  if (!raw) return new Date().toISOString();
  const s = String(raw).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return s;
}

// Memory cache for reference lookups to enrich sales with region, IDs, and roles
let outletLookupCache: Map<string, { id: string; name: string; region_id?: string | null; state?: string | null }> | null = null;
let staffLookupCache: Map<string, { id: string; name: string; region?: string | null; role_key?: string | null }> | null = null;

async function loadLookups() {
  if (!outletLookupCache) {
    try {
      const { data } = await supabase.from("outlets").select("id, name, region_id, state");
      if (data) {
        outletLookupCache = new Map();
        data.forEach((o: any) => {
          if (o.name) {
            outletLookupCache!.set(o.name.trim().toLowerCase(), o);
          }
        });
      }
    } catch (e) {
      console.warn("Outlets lookup cache notice:", e);
    }
  }

  if (!staffLookupCache) {
    try {
      const { data } = await supabase
        .from("staff")
        .select("id, name, region, assigned_role, user_roles ( key, name )");
      if (data) {
        staffLookupCache = new Map();
        data.forEach((s: any) => {
          if (s.name) {
            const roleRel = Array.isArray(s.user_roles) ? s.user_roles[0] : s.user_roles;
            staffLookupCache!.set(s.name.trim().toLowerCase(), {
              id: s.id,
              name: s.name,
              region: s.region,
              role_key: roleRel?.key || s.assigned_role,
            });
          }
        });
      }
    } catch (e) {
      console.warn("Staff lookup cache notice:", e);
    }
  }
}

export async function getSales(
  startDate?: string,
  endDate?: string
): Promise<Sale[]> {
  const localSales = getLocalSales();

  try {
    // Pre-load reference lookups in parallel
    await loadLookups();

    // Fetch all sales rows from Supabase across 1000-row pages
    const pageSize = 1000;
    let allRawRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn("Supabase fetch sales error at offset", from, error);
        break;
      }

      if (data && data.length > 0) {
        allRawRows = allRawRows.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    if (allRawRows.length > 0) {
      const remoteSales: Sale[] = allRawRows
        // Filter out shifted CSV rows where Transaction ID / Reference are missing
        .filter((row: any) => {
          const txn = row["Transaction ID"] || row.transaction_id;
          const ref = row["Reference"] || row.reference;
          return Boolean(txn || ref);
        })
        .map((row: any) => {
          // Extract values supporting both Title Case ("Total Amount") and snake_case (total_amount)
          const outletName = (row["Outlet"] || row.outlet || "").trim();
          const staffName = (row["Staff Name"] || row.staff || "").trim();
          const drinkName = (row["Drink Type"] || row.drink_type || "").trim();
          const ref = row["Reference"] || row.reference || null;
          const txnId = row["Transaction ID"] || row.transaction_id || null;

          const matchedOutlet = outletLookupCache?.get(outletName.toLowerCase());
          const matchedStaff = staffLookupCache?.get(staffName.toLowerCase());

          const totalAmount = parseCurrencyNumber(row["Total Amount"] ?? row.total_amount);
          const amountPaid = parseCurrencyNumber(row["Amount Paid"] ?? row.amount_paid);
          const balance = parseCurrencyNumber(row["Balance"] ?? row.balance ?? (totalAmount - amountPaid));
          const quantity = Number(row["Quantity"] ?? row.quantity ?? 0);
          const unitType = parseUnitType(row["Unit Type"] ?? row.unit_type);
          const paymentStatus = parsePaymentStatus(row["Payment Status"] ?? row.payment_status);

          const rawSaleDate = row["Sale Date"] || row.sale_date || row["Created On"] || row.created_at;
          const parsedSaleDate = parseSaleDateToIso(rawSaleDate);
          const parsedCreatedAt = parseTimestampToIso(row["Created On"] || row.created_at || rawSaleDate);

          return {
            id: row.id || ref || txnId || `sale-${Math.random()}`,
            created_at: parsedCreatedAt,
            sale_date: parsedSaleDate,
            quantity,
            unit_type: unitType,
            total_amount: totalAmount,
            amount_paid: amountPaid,
            balance,
            payment_status: paymentStatus,
            reference: ref,
            transaction_id: txnId,
            staff: staffName || matchedStaff?.name || null,
            staff_id: matchedStaff?.id || row.staff_id,
            staff_role: matchedStaff?.role_key || row.staff_role,
            staff_region: matchedStaff?.region || row.staff_region,
            outlet: outletName || matchedOutlet?.name || null,
            outlet_id: matchedOutlet?.id || row.outlet_id,
            outlet_region: matchedOutlet?.region_id || matchedOutlet?.state || row.outlet_region,
            outlet_state: matchedOutlet?.state || row.outlet_state,
            drink_type: drinkName || null,
            notes: row["Notes"] || row.notes || null,
            status: row["Status"] || row.status || "Active",
          };
        });

      // Sort descending by date
      remoteSales.sort((a, b) => {
        const da = a.sale_date || a.created_at || "";
        const db = b.sale_date || b.created_at || "";
        return db.localeCompare(da);
      });

      // Filter by date parameters if specified
      const filtered = remoteSales.filter((s) => {
        if (startDate && s.sale_date && s.sale_date < startDate) return false;
        if (endDate && s.sale_date && s.sale_date > endDate) return false;
        return true;
      });

      // Preserve any pending offline sales not yet in Supabase
      const pendingTxns = new Set(getPendingSales().map((p) => p.transaction_id || p["Transaction ID"]));
      const pendingLocalSales = localSales.filter((s) => s.transaction_id && pendingTxns.has(s.transaction_id));

      const mergedMap = new Map<string, Sale>();
      remoteSales.forEach((s) => mergedMap.set(s.id, s));
      pendingLocalSales.forEach((s) => {
        if (!mergedMap.has(s.id)) mergedMap.set(s.id, s);
      });

      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => {
        const da = a.sale_date || a.created_at || "";
        const db = b.sale_date || b.created_at || "";
        return db.localeCompare(da);
      });

      // Cache locally
      saveLocalSales(merged);

      // Trigger background sync for pending sales
      void syncPendingSales();
      return filtered;
    }
  } catch (err) {
    console.warn("getSales remote query notice:", err);
  }

  // If remote fails, return local sales
  if (localSales.length > 0) {
    return localSales.filter((s) => {
      if (startDate && s.sale_date && s.sale_date < startDate) return false;
      if (endDate && s.sale_date && s.sale_date > endDate) return false;
      return true;
    });
  }

  return [];
}

export type SaleItemInput = {
  drinkTypeId: string;
  quantity: number;
  unitType: number;
  unitPrice: number;
  totalAmount: number;
};

export type CreateMultipleSalesInput = {
  outletId: string;
  saleDate: string;
  paymentMethod: number;
  amountPaid: number;
  items: SaleItemInput[];
};

export async function createMultipleSales(input: CreateMultipleSalesInput) {
  const { outletId, saleDate, paymentMethod, amountPaid, items } = input;

  if (!items || items.length === 0) {
    throw new Error("Please add at least one sale item.");
  }

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let authenticatedStaffId: string | null = null;
  let staffName: string = "Sales Rep";
  let staffRegion: string = "National";

  if (user) {
    const { data: currentStaff } = await supabase
      .from("staff")
      .select("id, name, region")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (currentStaff) {
      authenticatedStaffId = currentStaff.id;
      staffName = currentStaff.name;
      staffRegion = currentStaff.region || "National";
    }
  }

  // Look up outlet name
  let outletName = "Direct Outlet";
  let outletRegion = staffRegion;
  let outletState = staffRegion;

  try {
    const { data: outletData } = await supabase
      .from("outlets")
      .select("id, name, region_id, state")
      .eq("id", outletId)
      .maybeSingle();

    if (outletData) {
      outletName = outletData.name;
      outletRegion = outletData.region_id || outletData.state || staffRegion;
      outletState = outletData.state || staffRegion;
    }
  } catch (e) {
    console.warn("Outlet lookup notice:", e);
  }

  // Look up drink names
  const drinkNameMap = new Map<string, string>();
  try {
    const { data: drinks } = await supabase.from("drink_types").select("id, name");
    if (drinks) {
      drinks.forEach((d: any) => drinkNameMap.set(d.id, d.name));
    }
  } catch (e) {
    console.warn("Drink lookup notice:", e);
  }

  const timestamp = Date.now();
  const transactionId = `TXN-${timestamp}`;

  let remainingPaid = amountPaid;

  const salePayloads = items.map((item, index) => {
    const itemPaid = Math.min(item.totalAmount, remainingPaid);
    remainingPaid -= itemPaid;

    const itemBalance = item.totalAmount - itemPaid;
    const itemPaymentStatus =
      itemPaid >= item.totalAmount ? 2 : itemPaid > 0 ? 1 : 0;
    const paymentStatusStr =
      itemPaymentStatus === 2 ? "Paid" : itemPaymentStatus === 1 ? "Partial" : "Pending";
    const drinkName = drinkNameMap.get(item.drinkTypeId) || "Beverage";

    return {
      "Transaction ID": transactionId,
      "Reference": `SALE-${timestamp}-${index + 1}`,
      "Sale Date": saleDate,
      "Staff Name": staffName,
      "Outlet": outletName,
      "Drink Type": drinkName,
      "Quantity": item.quantity,
      "Unit Type": item.unitType === 2 ? "Cases" : "Bottles",
      "Total Amount": item.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }),
      "Amount Paid": itemPaid.toLocaleString("en-US", { minimumFractionDigits: 2 }),
      "Balance": itemBalance.toLocaleString("en-US", { minimumFractionDigits: 2 }),
      "Payment Status": paymentStatusStr,
      "Currency": "Nigerian Naira",
      "Notes": "Recorded from application",
      "Status": "Active",
      "Created On": new Date().toLocaleString("en-US"),
      "Modified On": new Date().toLocaleString("en-US"),
      // Also provide snake_case columns
      transaction_id: transactionId,
      reference: `SALE-${timestamp}-${index + 1}`,
      sale_date: saleDate,
      staff: staffName,
      outlet: outletName,
      drink_type: drinkName,
      quantity: item.quantity,
      unit_type: item.unitType === 2 ? "Cases" : "Bottles",
      total_amount: item.totalAmount,
      amount_paid: itemPaid,
      balance: itemBalance,
      payment_status: paymentStatusStr,
      created_at: new Date().toISOString(),
    };
  });

  // Save to local sales cache
  const localItems: Sale[] = salePayloads.map((p, idx) => ({
    id: `local-sale-${timestamp}-${idx}`,
    created_at: p.created_at,
    sale_date: p.sale_date,
    quantity: p.quantity,
    unit_type: items[idx].unitType,
    total_amount: p.total_amount,
    amount_paid: p.amount_paid,
    balance: p.balance,
    payment_status: p.payment_status === "Paid" ? 2 : p.payment_status === "Partial" ? 1 : 0,
    payment_method: paymentMethod,
    reference: p.reference,
    transaction_id: p.transaction_id,
    staff: staffName,
    staff_id: authenticatedStaffId || undefined,
    staff_region: staffRegion,
    outlet: outletName,
    outlet_id: outletId,
    outlet_region: outletRegion,
    outlet_state: outletState,
    drink_type: drinkNameMap.get(items[idx]?.drinkTypeId) || "Beverage",
  }));

  const existingLocal = getLocalSales();
  saveLocalSales([...localItems, ...existingLocal]);

  // Attempt Supabase insert if online
  let wasInsertedRemotely = false;
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const { data: createdSales, error: salesError } = await supabase
        .from("sales")
        .insert(salePayloads)
        .select();

      if (!salesError && createdSales && createdSales.length > 0) {
        wasInsertedRemotely = true;
        return createdSales;
      }
      if (salesError) {
        console.warn("Supabase sales insert notice (queuing for offline sync):", salesError);
      }
    } catch (err) {
      console.warn("Notice: remote sales insert notice (queuing for offline sync):", err);
    }
  }

  // If not confirmed remotely, queue in pending sales for offline sync
  if (!wasInsertedRemotely) {
    savePendingSales([...getPendingSales(), ...salePayloads]);
  }

  return localItems;
}

export async function createSale(input: {
  outletId: string;
  drinkTypeId: string;
  quantity: number;
  unitType: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: number;
  saleDate: string;
  paymentMethod: number;
  staffName?: string;
  staffId?: string;
  drinkName?: string;
}) {
  const result = await createMultipleSales({
    outletId: input.outletId,
    saleDate: input.saleDate,
    paymentMethod: input.paymentMethod,
    amountPaid: input.amountPaid,
    items: [
      {
        drinkTypeId: input.drinkTypeId,
        quantity: input.quantity,
        unitType: input.unitType,
        unitPrice: input.unitPrice,
        totalAmount: input.totalAmount,
      },
    ],
  });

  return result?.[0];
}

export async function updateSale(
  id: string,
  updates: Partial<Sale>
): Promise<Sale> {
  const localSales = getLocalSales();
  const existingSale = localSales.find((s) => s.id === id);

  const updatedSale: Sale = {
    ...(existingSale || ({} as Sale)),
    ...updates,
    id,
  };

  // Recompute balance if total_amount or amount_paid changed
  if (updates.total_amount !== undefined || updates.amount_paid !== undefined) {
    const total =
      updates.total_amount !== undefined
        ? Number(updates.total_amount)
        : Number(updatedSale.total_amount || 0);
    const paid =
      updates.amount_paid !== undefined
        ? Number(updates.amount_paid)
        : Number(updatedSale.amount_paid || 0);
    updatedSale.total_amount = total;
    updatedSale.amount_paid = paid;
    updatedSale.balance = Math.max(0, total - paid);
    if (paid >= total && total > 0) {
      updatedSale.payment_status = 2; // Paid
    } else if (paid > 0) {
      updatedSale.payment_status = 1; // Partial
    } else {
      updatedSale.payment_status = 0; // Unpaid
    }
  }

  // Update local storage
  if (existingSale) {
    saveLocalSales(localSales.map((s) => (s.id === id ? updatedSale : s)));
  } else {
    saveLocalSales([updatedSale, ...localSales]);
  }

  // If this is a remote Supabase record
  if (!id.startsWith("local-")) {
    const paymentStatusStr =
      updatedSale.payment_status === 2
        ? "Paid"
        : updatedSale.payment_status === 1
        ? "Partial"
        : "Credit";
    const unitTypeStr = updatedSale.unit_type === 2 ? "Cases" : "Bottles";

    const payload: Record<string, any> = {};

    if (updates.sale_date !== undefined) {
      payload.sale_date = updates.sale_date;
      payload["Sale Date"] = updates.sale_date;
    }
    if (updates.outlet !== undefined) {
      payload.outlet = updates.outlet;
      payload["Outlet"] = updates.outlet;
    }
    if (updates.drink_type !== undefined) {
      payload.drink_type = updates.drink_type;
      payload["Drink Type"] = updates.drink_type;
    }
    if (updates.staff !== undefined) {
      payload.staff = updates.staff;
      payload["Staff Name"] = updates.staff;
    }
    if (updates.quantity !== undefined) {
      payload.quantity = updates.quantity;
      payload["Quantity"] = updates.quantity;
    }
    if (updates.unit_type !== undefined) {
      payload.unit_type = unitTypeStr;
      payload["Unit Type"] = unitTypeStr;
    }
    if (updates.total_amount !== undefined) {
      payload.total_amount = updatedSale.total_amount;
      payload["Total Amount"] = String(updatedSale.total_amount);
    }
    if (updates.amount_paid !== undefined) {
      payload.amount_paid = updatedSale.amount_paid;
      payload["Amount Paid"] = String(updatedSale.amount_paid);
    }
    if (updatedSale.balance !== undefined) {
      payload.balance = updatedSale.balance;
      payload["Balance"] = String(updatedSale.balance);
    }
    if (updatedSale.payment_status !== undefined) {
      payload.payment_status = paymentStatusStr;
      payload["Payment Status"] = paymentStatusStr;
    }
    if (updates.notes !== undefined) {
      payload.notes = updates.notes;
      payload["Notes"] = updates.notes;
    }

    try {
      const { error } = await supabase.from("sales").update(payload).eq("id", id);
      if (error) {
        console.warn("Supabase sales update notice:", error);
      }
    } catch (err) {
      console.warn("Notice: remote sales update failed:", err);
    }
  }

  return updatedSale;
}

export async function deleteSale(id: string): Promise<void> {
  // Remove from local storage
  const localSales = getLocalSales();
  saveLocalSales(localSales.filter((s) => s.id !== id));

  // If remote Supabase record, delete from Supabase
  if (!id.startsWith("local-")) {
    try {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) {
        console.warn("Supabase sales delete notice:", error);
      }
    } catch (err) {
      console.warn("Notice: remote sales delete failed:", err);
    }
  }
}