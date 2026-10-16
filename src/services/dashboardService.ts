import { supabase } from "../lib/supabase";

export async function getDashboardKpis(
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase.rpc(
    "get_dashboard_kpis",
    {
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (error) {
    console.error(
      "Dashboard KPI error:",
      error
    );

    throw error;
  }

  return data;
}

export async function getSalesSummary(
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase.rpc(
    "get_sales_summary",
    {
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (error) {
    console.error(
      "Sales summary error:",
      error
    );

    throw error;
  }

  return data;
}

export async function getStaffPerformance(
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase.rpc(
    "get_staff_performance",
    {
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (error) {
    console.error(
      "Staff performance error:",
      error
    );

    throw error;
  }

  return data;
}