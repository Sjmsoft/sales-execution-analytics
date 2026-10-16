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

export async function getSales(
  startDate?: string,
  endDate?: string
): Promise<Sale[]> {
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

  if (error) {
    throw error;
  }

  return (data ?? []).map((sale: any) => {
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
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("AUTH ERROR:", userError);
    throw userError;
  }

  if (!user) {
    throw new Error("You are not signed in. Please sign in again.");
  }

  // 2. GET CURRENT STAFF RECORD
  const {
    data: currentStaff,
    error: staffError,
  } = await supabase
    .from("staff")
    .select("id, name, email")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (staffError) {
    console.error("STAFF LOOKUP ERROR:", staffError);
    throw staffError;
  }

  if (!currentStaff) {
    throw new Error("Your account is not linked to an active staff record.");
  }

  const authenticatedStaffId = currentStaff.id;

  // 3. VALIDATION
  if (!outletId) {
    throw new Error("Please select an outlet.");
  }

  if (!saleDate) {
    throw new Error("Please select a sale date.");
  }

  const aggregateTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);

  if (aggregateTotal <= 0) {
    throw new Error("Total sale amount must be greater than zero.");
  }

  if (amountPaid < 0) {
    throw new Error("Amount paid cannot be negative.");
  }

  if (amountPaid > aggregateTotal) {
    throw new Error("Amount paid cannot exceed total amount.");
  }

  if (amountPaid > 0 && !paymentMethod) {
    throw new Error("Please select a payment method.");
  }

  // 4. PREPARE SALE ROWS
  const timestamp = Date.now();
  const transactionId = `TXN-${timestamp}`;
  let remainingPaid = amountPaid;

  const salePayloads = items.map((item, index) => {
    let itemPaid = 0;
    if (amountPaid >= aggregateTotal) {
      itemPaid = item.totalAmount;
    } else if (remainingPaid > 0) {
      itemPaid = Math.min(item.totalAmount, remainingPaid);
      remainingPaid -= itemPaid;
    }

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

  // 5. INSERT SALES
  const { data: createdSales, error: salesError } = await supabase
    .from("sales")
    .insert(salePayloads)
    .select();

  if (salesError) {
    console.error("BATCH SALE INSERT ERROR:", salesError);
    throw new Error(`Unable to save sales: ${salesError.message}`);
  }

  // 6. RECORD PAYMENT
  if (amountPaid > 0 && createdSales && createdSales.length > 0) {
    const paymentPayload = {
      sale: createdSales[0].id,
      received_by: authenticatedStaffId,
      amount: amountPaid,
      payment_method: paymentMethod,
      payment_date: saleDate,
      reference: `PAY-${timestamp}`,
      created_at: new Date().toISOString(),
    };

    const { error: paymentError } = await supabase
      .from("payments")
      .insert(paymentPayload);

    if (paymentError) {
      console.warn("PAYMENT INSERT ERROR:", paymentError);
      // Non-fatal if payment table has extra constraints, sale records are saved.
    }
  }

  return createdSales;
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