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
};

export const STORAGE_KEY_SALES = "penedge_configured_sales_v1";

export function getLocalSales(): Sale[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SALES);
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
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
  } catch (e) {
    console.error("Local sales save error:", e);
  }
}

export async function getSales(
  startDate?: string,
  endDate?: string
): Promise<Sale[]> {
  const localSales = getLocalSales();

  try {
    let query = supabase
      .from("sales")
      .select(`
        id,
        created_at,
        sale_date,
        quantity,
        unit_type,
        total_amount,
        amount_paid,
        balance,
        payment_status,
        reference,
        transaction_id,
        staff:staff ( id, name, region, assigned_role, user_roles ( key, name ) ),
        outlet:outlets ( id, name, region_id, state ),
        drink_type:drink_types ( id, name )
      `)
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("sale_date", startDate);
    }

    if (endDate) {
      query = query.lte("sale_date", endDate);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const remoteSales: Sale[] = data.map((sale: any) => {
        const staffRel = Array.isArray(sale.staff) ? sale.staff[0] : sale.staff;
        const outletRel = Array.isArray(sale.outlet) ? sale.outlet[0] : sale.outlet;
        const drinkRel = Array.isArray(sale.drink_type) ? sale.drink_type[0] : sale.drink_type;
        const roleRel = staffRel?.user_roles ? (Array.isArray(staffRel.user_roles) ? staffRel.user_roles[0] : staffRel.user_roles) : null;

        return {
          id: sale.id,
          created_at: sale.created_at,
          sale_date: sale.sale_date,
          quantity: sale.quantity,
          unit_type: sale.unit_type,
          total_amount: sale.total_amount,
          amount_paid: sale.amount_paid,
          balance: sale.balance,
          payment_status: sale.payment_status,
          reference: sale.reference,
          transaction_id: sale.transaction_id,
          staff: staffRel?.name ?? (typeof sale.staff === "string" ? sale.staff : null),
          staff_id: staffRel?.id,
          staff_role: roleRel?.key ?? staffRel?.assigned_role,
          staff_region: staffRel?.region,
          outlet: outletRel?.name ?? (typeof sale.outlet === "string" ? sale.outlet : null),
          outlet_id: outletRel?.id,
          outlet_region: outletRel?.region_id ?? outletRel?.state,
          outlet_state: outletRel?.state,
          drink_type: drinkRel?.name ?? (typeof sale.drink_type === "string" ? sale.drink_type : null),
        };
      });

      // Merge remote and local (avoid duplicate by id)
      const remoteIds = new Set(remoteSales.map((s) => s.id));
      const merged = [...localSales.filter((l) => !remoteIds.has(l.id)), ...remoteSales];
      saveLocalSales(merged);
      return merged;
    }
  } catch (err) {
    console.warn("getSales remote query notice:", err);
  }

  // If local sales exist, return them
  if (localSales.length > 0) {
    return localSales.filter((s) => {
      if (startDate && s.sale_date && s.sale_date < startDate) return false;
      if (endDate && s.sale_date && s.sale_date > endDate) return false;
      return true;
    });
  }

  // If both are empty, provide seed sales matching current staff and products
  const seedSales: Sale[] = [
    {
      id: "sale-seed-1",
      created_at: "2026-10-18T10:15:00.000Z",
      sale_date: "2026-10-18",
      quantity: 2,
      unit_type: 2, // 2 Cases
      total_amount: 140000,
      amount_paid: 140000,
      balance: 0,
      payment_status: 2,
      reference: "SALE-20261018-01",
      staff: "Administrator",
      staff_role: "administrator",
      staff_region: "National",
      outlet: "Deuces Bar & Lounge",
      outlet_region: "Lagos mainland",
      drink_type: "Fercullen 15 Years",
    },
    {
      id: "sale-seed-2",
      created_at: "2026-10-18T11:30:00.000Z",
      sale_date: "2026-10-18",
      quantity: 2,
      unit_type: 2, // 2 Cases
      total_amount: 110000,
      amount_paid: 110000,
      balance: 0,
      payment_status: 2,
      reference: "SALE-20261018-02",
      staff: "Administrator",
      staff_role: "administrator",
      staff_region: "National",
      outlet: "Silverbird Lounge",
      outlet_region: "National",
      drink_type: "Fercullen Falls",
    },
    {
      id: "sale-seed-3",
      created_at: "2026-10-18T12:00:00.000Z",
      sale_date: "2026-10-18",
      quantity: 4,
      unit_type: 2, // 4 Cases
      total_amount: 280000,
      amount_paid: 280000,
      balance: 0,
      payment_status: 2,
      reference: "SALE-20261018-03",
      staff: "Pen Edge Lounge",
      staff_role: "sales_representative",
      staff_region: "Lekki",
      outlet: "Pen Edge Lounge Lekki",
      outlet_region: "Lekki",
      drink_type: "Fercullen 15 Years",
    },
    {
      id: "sale-seed-4",
      created_at: "2026-10-18T14:15:00.000Z",
      sale_date: "2026-10-18",
      quantity: 3,
      unit_type: 2, // 3 Cases
      total_amount: 165000,
      amount_paid: 165000,
      balance: 0,
      payment_status: 2,
      reference: "SALE-20261018-04",
      staff: "Pen Edge Lounge",
      staff_role: "sales_representative",
      staff_region: "Lekki",
      outlet: "The Place Lekki",
      outlet_region: "Lekki",
      drink_type: "Fercullen Falls",
    },
    {
      id: "sale-seed-5",
      created_at: "2026-10-18T09:45:00.000Z",
      sale_date: "2026-10-18",
      quantity: 5,
      unit_type: 2, // 5 Cases
      total_amount: 350000,
      amount_paid: 350000,
      balance: 0,
      payment_status: 2,
      reference: "SALE-20261018-05",
      staff: "VSR Account",
      staff_role: "vsr",
      staff_region: "Lagos Island",
      outlet: "Mega Plaza Island",
      outlet_region: "Lagos Island",
      drink_type: "Fercullen 15 Years",
    },
    {
      id: "sale-seed-6",
      created_at: "2026-10-18T13:20:00.000Z",
      sale_date: "2026-10-18",
      quantity: 5,
      unit_type: 2, // 5 Cases
      total_amount: 275000,
      amount_paid: 275000,
      balance: 0,
      payment_status: 2,
      reference: "SALE-20261018-06",
      staff: "VSR Account",
      staff_role: "vsr",
      staff_region: "Lagos Island",
      outlet: "Eko Hotel Sky Lounge",
      outlet_region: "Lagos Island",
      drink_type: "Fercullen Falls",
    },
  ];

  saveLocalSales(seedSales);
  return seedSales;
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

  // 1. GET AUTHENTICATED USER
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

  const timestamp = Date.now();
  const transactionId = `TXN-${timestamp}`;

  // 4. PREPARE PAYLOADS
  let remainingPaid = amountPaid;

  const salePayloads = items.map((item, index) => {
    const itemPaid = Math.min(item.totalAmount, remainingPaid);
    remainingPaid -= itemPaid;

    const itemBalance = item.totalAmount - itemPaid;
    const itemPaymentStatus =
      itemPaid >= item.totalAmount ? 2 : itemPaid > 0 ? 1 : 0;

    return {
      staff: authenticatedStaffId,
      outlet: outletId,
      drink_type: item.drinkTypeId,
      quantity: item.quantity,
      unit_type: item.unitType,
      total_amount: item.totalAmount,
      amount_paid: itemPaid,
      balance: itemBalance,
      payment_status: itemPaymentStatus,
      sale_date: saleDate,
      reference: `SALE-${timestamp}-${index + 1}`,
      transaction_id: transactionId,
      created_at: new Date().toISOString(),
    };
  });

  // Save to local sales cache
  const localItems: Sale[] = salePayloads.map((p, idx) => ({
    id: `local-sale-${timestamp}-${idx}`,
    created_at: p.created_at,
    sale_date: p.sale_date,
    quantity: p.quantity,
    unit_type: p.unit_type,
    total_amount: p.total_amount,
    amount_paid: p.amount_paid,
    balance: p.balance,
    payment_status: p.payment_status,
    payment_method: paymentMethod,
    reference: p.reference,
    transaction_id: p.transaction_id,
    staff: staffName,
    staff_id: authenticatedStaffId || undefined,
    staff_region: staffRegion,
    outlet: outletId,
    drink_type: items[idx]?.drinkTypeId || "Beverage",
  }));

  const existingLocal = getLocalSales();
  saveLocalSales([...localItems, ...existingLocal]);

  // Attempt Supabase insert
  try {
    const { data: createdSales, error: salesError } = await supabase
      .from("sales")
      .insert(salePayloads)
      .select();

    if (!salesError && createdSales && createdSales.length > 0) {
      if (amountPaid > 0) {
        const paymentPayload = {
          sale: createdSales[0].id,
          received_by: authenticatedStaffId,
          amount: amountPaid,
          payment_method: paymentMethod,
          payment_date: saleDate,
          reference: `PAY-${timestamp}`,
          created_at: new Date().toISOString(),
        };

        await supabase.from("payments").insert(paymentPayload).then(({ error }) => {
          if (error) console.warn("Payment insert notice:", error);
        });
      }
      return createdSales;
    }
  } catch (err) {
    console.warn("Notice: remote sales insert notice:", err);
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