import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import type { Sale } from "../../services/salesService";
import penEdgeLogo from "../../assets/pen-edge-logo.png";

export type InvoiceOutletInfo = {
  id: string;
  name: string;
  address?: string | null;
  lga?: string | null;
  state?: string | null;
  region_id?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
};

type InvoiceLineItem = {
  id: string;
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type PenEdgeInvoiceModalProps = {
  sale: Sale;
  allSales?: Sale[];
  outletsList?: InvoiceOutletInfo[];
  isAdmin?: boolean;
  onClose: () => void;
  onEditSale?: (sale: Sale) => void;
  onDeleteSale?: (sale: Sale) => void;
};

function formatInvoiceDateDdMmYyyy(dateStr?: string | null): string {
  if (!dateStr) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${dd} / ${mm} / ${yyyy}`;
  }
  const trimmed = dateStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]} / ${isoMatch[2]} / ${isoMatch[1]}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd} / ${mm} / ${yyyy}`;
  }
  return trimmed;
}

function buildDynamicInvoiceNumber(sale: Sale): string {
  const dateSource = sale.sale_date || sale.created_at || "";
  let mmyy = "1126";
  const isoMatch = dateSource.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    mmyy = `${isoMatch[2]}${isoMatch[1].slice(-2)}`;
  } else {
    const d = dateSource ? new Date(dateSource) : new Date();
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(-2);
      mmyy = `${mm}${yy}`;
    }
  }

  const rawRef = (sale.reference || sale.transaction_id || sale.id || "").trim();
  if (/^\d{4,6}-\d{4}$/.test(rawRef)) {
    return rawRef;
  }

  const digitsOnly = rawRef.replace(/\D/g, "");
  if (digitsOnly.length >= 5) {
    const serial = digitsOnly.slice(-5);
    return `${serial}-${mmyy}`;
  }

  let hash = 0;
  for (let i = 0; i < rawRef.length; i++) {
    hash = (hash * 31 + rawRef.charCodeAt(i)) % 90000;
  }
  const serial = String(10000 + Math.abs(hash)).slice(0, 5);
  return `${serial}-${mmyy}`;
}

const INVOICE_SCOPED_CSS = `
  .pe-invoice-backdrop {
    position: fixed !important;
    inset: 0 !important;
    z-index: 9999 !important;
    background: rgba(15, 23, 42, 0.72) !important;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex !important;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .pe-invoice-modal {
    width: 100%;
    max-width: 780px;
    max-height: calc(100dvh - 40px);
    background: #ffffff !important;
    border-radius: 14px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    margin: auto;
  }

  .pe-invoice-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 18px;
    background: #0f172a !important;
    color: #ffffff !important;
    border-bottom: 1px solid #1e293b;
    flex-shrink: 0;
  }

  .pe-invoice-topbar-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.82rem;
    font-weight: 700;
    color: #ffffff !important;
  }

  .pe-invoice-scroll-viewport {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    background: #e2e8f0 !important;
    padding: 20px;
    -webkit-overflow-scrolling: touch;
  }

  /* Actual White Commercial Invoice Sheet */
  .pe-invoice-sheet {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    background: #ffffff !important;
    color: #000000 !important;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    box-sizing: border-box;
    overflow: hidden;
  }

  .pe-invoice-inner {
    padding: 36px 44px 28px 44px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .pe-brand-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-bottom: 16px;
  }

  .pe-logo-img {
    width: 225px;
    max-width: 100%;
    height: auto;
    object-fit: contain;
    display: block;
    margin-bottom: 14px;
  }

  .pe-hq-address {
    width: 215px;
    text-align: left;
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.42;
    color: #000000 !important;
  }

  .pe-invoice-to-block {
    margin-bottom: 18px;
    max-width: 440px;
  }

  .pe-invoice-to-heading {
    font-size: 1.7rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: #000000 !important;
    margin: 0 0 8px 0;
    line-height: 1.15;
  }

  .pe-invoice-to-lines {
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.45;
    color: #000000 !important;
    word-break: break-word;
  }

  .pe-meta-row-right {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 40px;
  }

  .pe-meta-grid {
    display: grid;
    grid-template-columns: 115px 155px;
    row-gap: 14px;
    column-gap: 12px;
    align-items: center;
  }

  .pe-meta-label {
    font-size: 1.02rem;
    font-weight: 700;
    color: #000000 !important;
  }

  .pe-meta-value {
    font-size: 1.04rem;
    font-weight: 400;
    color: #000000 !important;
    text-align: right;
    white-space: nowrap;
  }

  /* Product Table — Explicitly overrides global table { min-width: 850px } in index.css */
  .pe-table-wrap {
    width: 100%;
    margin-bottom: 36px;
    overflow-x: hidden;
  }

  .pe-invoice-sheet table.pe-invoice-table {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    border-top: 1px solid #222222 !important;
    background: #ffffff !important;
  }

  .pe-invoice-sheet table.pe-invoice-table thead tr,
  .pe-invoice-sheet table.pe-invoice-table tbody tr {
    border-bottom: 1px solid #222222 !important;
    background: #ffffff !important;
  }

  .pe-invoice-sheet table.pe-invoice-table tbody tr:hover {
    background: #ffffff !important;
  }

  .pe-invoice-sheet table.pe-invoice-table th {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 0.92rem !important;
    font-weight: 700 !important;
    padding: 12px 10px !important;
    border: none !important;
    border-bottom: 1px solid #222222 !important;
    line-height: 1.3 !important;
  }

  .pe-invoice-sheet table.pe-invoice-table td {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 0.92rem !important;
    font-weight: 400 !important;
    padding: 11px 10px !important;
    border: none !important;
    border-bottom: 1px solid #222222 !important;
    line-height: 1.35 !important;
    vertical-align: middle !important;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .pe-col-product {
    width: 44% !important;
    text-align: left !important;
    padding-left: 12px !important;
  }

  .pe-col-qty {
    width: 16% !important;
    text-align: center !important;
  }

  .pe-col-price {
    width: 20% !important;
    text-align: center !important;
  }

  .pe-col-total {
    width: 20% !important;
    text-align: center !important;
    padding-right: 12px !important;
  }

  .pe-blank-row td {
    height: 44px !important;
  }

  /* Lower Payment & Total Row */
  .pe-payment-total-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 44px;
    flex-wrap: wrap;
  }

  .pe-payment-box {
    flex: 1 1 240px;
    min-width: 200px;
  }

  .pe-payment-heading {
    font-size: 0.95rem;
    font-weight: 800;
    color: #000000 !important;
    letter-spacing: 0.02em;
    margin-bottom: 14px;
  }

  .pe-payment-lines {
    font-size: 0.94rem;
    color: #000000 !important;
    line-height: 1.75;
  }

  .pe-grand-total-box {
    flex: 0 1 270px;
    min-width: 220px;
    padding-top: 14px;
    margin-top: 28px;
    border-top: 1.5px solid #222222;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  .pe-grand-total-label {
    font-size: 1.35rem;
    font-weight: 700;
    color: #000000 !important;
  }

  .pe-grand-total-amount {
    font-size: 1.4rem;
    font-weight: 800;
    color: #000000 !important;
    white-space: nowrap;
  }

  /* Terms & Conditions */
  .pe-terms-block {
    margin-top: auto;
    padding-top: 8px;
  }

  .pe-terms-title {
    color: #ef4444 !important;
    font-size: 0.7rem;
    font-weight: 700;
    margin-bottom: 3px;
  }

  .pe-terms-body {
    color: #111827 !important;
    font-size: 0.66rem;
    line-height: 1.42;
    max-width: 380px;
  }

  /* Bottom Navy Bar */
  .pe-footer-navy-bar {
    background: #2e2a7b !important;
    color: #ffffff !important;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
    flex-wrap: wrap;
    font-size: 0.83rem;
  }

  .pe-footer-contact-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #ffffff !important;
  }

  /* Modal Bottom Action Bar */
  .pe-modal-action-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: #f8fafc !important;
    border-top: 1px solid #e2e8f0;
    flex-wrap: wrap;
    gap: 10px;
    flex-shrink: 0;
  }

  .pe-action-buttons-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pe-edit-input {
    font-family: inherit;
    font-size: 0.88rem;
    color: #0f172a !important;
    background: #f8fafc !important;
    border: 1px dashed #64748b !important;
    border-radius: 4px;
    padding: 4px 8px;
    box-sizing: border-box;
    width: 100%;
  }

  /* ── Responsive Mobile Optimizations (< 640px) ── */
  @media (max-width: 640px) {
    .pe-invoice-backdrop {
      padding: 8px !important;
      align-items: flex-end;
    }

    .pe-invoice-modal {
      max-height: calc(100dvh - 16px);
      border-radius: 12px;
    }

    .pe-invoice-topbar {
      padding: 10px 12px;
    }

    .pe-invoice-topbar-title {
      font-size: 0.75rem;
    }

    .pe-invoice-scroll-viewport {
      padding: 10px;
    }

    .pe-invoice-inner {
      padding: 22px 16px 18px 16px;
    }

    .pe-logo-img {
      width: 170px;
      margin-bottom: 10px;
    }

    .pe-hq-address {
      width: 175px;
      font-size: 0.76rem;
    }

    .pe-invoice-to-heading {
      font-size: 1.25rem;
      margin-bottom: 6px;
    }

    .pe-invoice-to-lines {
      font-size: 0.82rem;
    }

    .pe-meta-row-right {
      margin-bottom: 24px;
    }

    .pe-meta-grid {
      grid-template-columns: 85px 125px;
      row-gap: 8px;
    }

    .pe-meta-label,
    .pe-meta-value {
      font-size: 0.86rem;
    }

    .pe-table-wrap {
      margin-bottom: 24px;
    }

    .pe-invoice-sheet table.pe-invoice-table th {
      font-size: 0.74rem !important;
      padding: 9px 4px !important;
    }

    .pe-invoice-sheet table.pe-invoice-table td {
      font-size: 0.76rem !important;
      padding: 9px 4px !important;
    }

    .pe-col-product {
      width: 38% !important;
      padding-left: 6px !important;
    }

    .pe-col-qty {
      width: 14% !important;
    }

    .pe-col-price {
      width: 24% !important;
    }

    .pe-col-total {
      width: 24% !important;
      padding-right: 6px !important;
    }

    .pe-blank-row td {
      height: 34px !important;
    }

    .pe-payment-total-row {
      flex-direction: column;
      gap: 18px;
      margin-bottom: 28px;
    }

    .pe-payment-box {
      flex: 1 1 auto;
      width: 100%;
    }

    .pe-payment-heading {
      font-size: 0.84rem;
      margin-bottom: 8px;
    }

    .pe-payment-lines {
      font-size: 0.82rem;
      line-height: 1.6;
    }

    .pe-grand-total-box {
      flex: 1 1 auto;
      width: 100%;
      margin-top: 4px;
      padding-top: 12px;
    }

    .pe-grand-total-label {
      font-size: 1.1rem;
    }

    .pe-grand-total-amount {
      font-size: 1.15rem;
    }

    .pe-footer-navy-bar {
      padding: 12px 14px;
      gap: 10px 18px;
      font-size: 0.72rem;
      justify-content: flex-start;
    }

    .pe-modal-action-footer {
      padding: 10px 12px;
      flex-direction: column;
      align-items: stretch;
    }

    .pe-action-buttons-group {
      width: 100%;
      justify-content: flex-end;
    }
  }
`;

export function PenEdgeInvoiceModal({
  sale,
  allSales = [],
  outletsList = [],
  isAdmin = false,
  onClose,
  onEditSale,
  onDeleteSale,
}: PenEdgeInvoiceModalProps) {
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Prevent background page scroll while modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Resolve matching outlet details dynamically from outlets directory
  const matchedOutlet = useMemo(() => {
    const targetId = (sale.outlet_id || "").trim().toLowerCase();
    const targetName = (sale.outlet || "").trim().toLowerCase();
    return (
      outletsList.find(
        (o) =>
          (targetId && o.id.trim().toLowerCase() === targetId) ||
          (targetName && o.name.trim().toLowerCase() === targetName)
      ) || null
    );
  }, [outletsList, sale.outlet, sale.outlet_id]);

  // Build initial dynamic INVOICE TO lines
  const initialRecipientLine1 = useMemo(() => {
    const outletName = sale.outlet || matchedOutlet?.name || "Walk-in Customer";
    const addr = matchedOutlet?.address?.trim();
    if (addr && addr.toLowerCase() !== "address not specified") {
      return `${outletName} , ${addr},`;
    }
    return outletName;
  }, [sale.outlet, matchedOutlet]);

  const initialRecipientLine2 = useMemo(() => {
    const lga =
      matchedOutlet?.lga && matchedOutlet.lga.toLowerCase() !== "unassigned"
        ? matchedOutlet.lga.trim()
        : "";
    const stateOrRegion =
      (matchedOutlet?.state && matchedOutlet.state.toLowerCase() !== "unassigned"
        ? matchedOutlet.state.trim()
        : "") ||
      sale.outlet_state ||
      sale.outlet_region ||
      matchedOutlet?.region_id ||
      "";
    const phone = matchedOutlet?.contact_person_phone?.trim() || "";
    const locPart = [lga, stateOrRegion].filter(Boolean).join(", ");
    return [locPart, phone].filter(Boolean).join(" ") || "Nigeria";
  }, [matchedOutlet, sale.outlet_state, sale.outlet_region]);

  // Gather all line items belonging to this sale / reference
  const initialItems = useMemo<InvoiceLineItem[]>(() => {
    const ref = (sale.reference || "").trim();
    const related =
      ref && allSales.length > 0
        ? allSales.filter((s) => (s.reference || "").trim() === ref)
        : [sale];
    const sourceList = related.length > 0 ? related : [sale];

    return sourceList.map((item, idx) => {
      const qty = Math.max(1, Number(item.quantity ?? 1));
      const total = Number(item.total_amount ?? 0);
      const unitPrice = qty > 0 ? Math.round(total / qty) : total;
      return {
        id: `${item.id || idx}`,
        product: item.drink_type || "Beverage Product",
        quantity: qty,
        unitPrice,
        total,
      };
    });
  }, [sale, allSales]);

  // Dynamic state (auto-populated from sale & outlet; only Admin can customize)
  const [invoiceNumber, setInvoiceNumber] = useState(() => buildDynamicInvoiceNumber(sale));
  const [invoiceDate, setInvoiceDate] = useState(() =>
    formatInvoiceDateDdMmYyyy(sale.sale_date || sale.created_at)
  );
  const [recipientLine1, setRecipientLine1] = useState(initialRecipientLine1);
  const [recipientLine2, setRecipientLine2] = useState(initialRecipientLine2);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(initialItems);
  const [bankName, setBankName] = useState("FCMB");
  const [accountName, setAccountName] = useState("Pen Edge Limited Account");
  const [accountNumber, setAccountNumber] = useState("2004372872");
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Strictly enforce that only Administrators can enter customization mode
  const canCustomize = Boolean(isAdmin && isCustomizing);

  const grandTotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [lineItems]
  );

  // Ensure at least 4 ruled table rows (matching the attached PDF layout)
  const emptyRowCount = Math.max(0, 4 - lineItems.length);

  function handleUpdateLineItem(
    index: number,
    field: "product" | "quantity" | "unitPrice",
    value: string
  ) {
    if (!isAdmin) return;
    setLineItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === "product") {
          return { ...item, product: value };
        }
        const num = Math.max(0, Number(value.replace(/,/g, "")) || 0);
        if (field === "quantity") {
          const qty = Math.max(1, Math.round(num));
          return { ...item, quantity: qty, total: qty * item.unitPrice };
        }
        return { ...item, unitPrice: num, total: item.quantity * num };
      })
    );
  }

  function handleAddLineItem() {
    if (!isAdmin) return;
    setLineItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        product: "New Product",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  }

  function handleRemoveLineItem(index: number) {
    if (!isAdmin || lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handlePrintInvoice() {
    if (!printSheetRef.current) {
      window.print();
      return;
    }
    const printContents = printSheetRef.current.innerHTML;
    const printWin = window.open("", "_blank", "width=900,height=1150");
    if (!printWin) {
      window.print();
      return;
    }
    printWin.document.open();
    printWin.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Pen Edge Limited - Invoice #${invoiceNumber}</title>
    <style>
      ${INVOICE_SCOPED_CSS}
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
        color: #000000 !important;
      }
      .pe-invoice-sheet {
        width: 210mm !important;
        max-width: 210mm !important;
        min-height: 297mm !important;
        margin: 0 auto !important;
        box-shadow: none !important;
      }
      .pe-invoice-inner {
        padding: 38px 46px 28px 46px !important;
        flex: 1;
      }
      .pe-no-print {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <div class="pe-invoice-sheet">${printContents}</div>
    <script>
      (function() {
        function triggerPrint() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 150);
        }
        var imgs = Array.prototype.slice.call(document.images || []);
        var pending = imgs.filter(function(img) { return !img.complete; });
        if (pending.length === 0) {
          if (document.readyState === 'complete') {
            triggerPrint();
          } else {
            window.addEventListener('load', triggerPrint, { once: true });
          }
        } else {
          var remaining = pending.length;
          var done = function() {
            remaining--;
            if (remaining <= 0) triggerPrint();
          };
          pending.forEach(function(img) {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
        }
      })();
    </script>
  </body>
</html>`);
    printWin.document.close();
  }

  const modalContent = (
    <div
      className="pe-invoice-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <style>{INVOICE_SCOPED_CSS}</style>

      <div
        className="pe-invoice-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Pen Edge Limited Invoice ${invoiceNumber}`}
      >
        {/* Top Floating Modal Action Header (Non-Printed) */}
        <div className="pe-invoice-topbar pe-no-print">
          <div className="pe-invoice-topbar-title">
            <span>PEN EDGE LIMITED — Commercial Invoice</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.14)",
                color: "#cbd5e1",
                fontWeight: 600,
              }}
            >
              #{invoiceNumber}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsCustomizing((v) => !v)}
                style={{
                  background: isCustomizing ? "#2563eb" : "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  whiteSpace: "nowrap",
                }}
                title="Customize invoice fields inline before printing (Admin Only)"
              >
                <Pencil size={12} />
                <span>{isCustomizing ? "Done Customizing" : "Customize View"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none",
                color: "#e2e8f0",
                cursor: "pointer",
                padding: "5px",
                borderRadius: "6px",
                display: "inline-flex",
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable Invoice Sheet Container */}
        <div className="pe-invoice-scroll-viewport">
          {/* ── ACTUAL PEN EDGE LIMITED INVOICE SHEET (Matches Attached PDF) ── */}
          <div ref={printSheetRef} className="pe-invoice-sheet">
            <div className="pe-invoice-inner">
              {/* 1. TOP RIGHT: PEN EDGE LIMITED LOGO & HEADQUARTERS ADDRESS */}
              <div className="pe-brand-block">
                <img
                  src={penEdgeLogo}
                  alt="Pen Edge Limited"
                  className="pe-logo-img"
                />

                <div className="pe-hq-address">
                  <div>2a Kudirat Abiola way,</div>
                  <div>Alausa Ikeja,</div>
                  <div>Lagos Nigeria</div>
                </div>
              </div>

              {/* 2. INVOICE TO (LEFT) */}
              <div className="pe-invoice-to-block">
                <div className="pe-invoice-to-heading">INVOICE TO:</div>

                {canCustomize ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input
                      type="text"
                      className="pe-edit-input"
                      value={recipientLine1}
                      onChange={(e) => setRecipientLine1(e.target.value)}
                      placeholder="Outlet Name, Street Address"
                    />
                    <input
                      type="text"
                      className="pe-edit-input"
                      value={recipientLine2}
                      onChange={(e) => setRecipientLine2(e.target.value)}
                      placeholder="City / State & Phone Number"
                    />
                  </div>
                ) : (
                  <div className="pe-invoice-to-lines">
                    <div>{recipientLine1}</div>
                    <div>{recipientLine2}</div>
                  </div>
                )}
              </div>

              {/* 3. INVOICE# & DATE BLOCK (RIGHT ALIGNED) */}
              <div className="pe-meta-row-right">
                <div className="pe-meta-grid">
                  <span className="pe-meta-label">Invoice#</span>
                  {canCustomize ? (
                    <input
                      type="text"
                      className="pe-edit-input"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      style={{ textAlign: "right" }}
                    />
                  ) : (
                    <span className="pe-meta-value">{invoiceNumber}</span>
                  )}

                  <span className="pe-meta-label">Date</span>
                  {canCustomize ? (
                    <input
                      type="text"
                      className="pe-edit-input"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      style={{ textAlign: "right" }}
                    />
                  ) : (
                    <span className="pe-meta-value">{invoiceDate}</span>
                  )}
                </div>
              </div>

              {/* 4. PRODUCT TABLE */}
              <div className="pe-table-wrap">
                <table className="pe-invoice-table">
                  <thead>
                    <tr>
                      <th className="pe-col-product">Product</th>
                      <th className="pe-col-qty">Quantity</th>
                      <th className="pe-col-price">Unit Price</th>
                      <th className="pe-col-total">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="pe-col-product">
                          {canCustomize ? (
                            <input
                              type="text"
                              className="pe-edit-input"
                              value={item.product}
                              onChange={(e) =>
                                handleUpdateLineItem(idx, "product", e.target.value)
                              }
                            />
                          ) : (
                            item.product
                          )}
                        </td>
                        <td className="pe-col-qty">
                          {canCustomize ? (
                            <input
                              type="number"
                              min={1}
                              className="pe-edit-input"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateLineItem(idx, "quantity", e.target.value)
                              }
                              style={{ textAlign: "center" }}
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="pe-col-price">
                          {canCustomize ? (
                            <input
                              type="number"
                              min={0}
                              className="pe-edit-input"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateLineItem(idx, "unitPrice", e.target.value)
                              }
                              style={{ textAlign: "center" }}
                            />
                          ) : (
                            `₦${Number(item.unitPrice || 0).toLocaleString()}`
                          )}
                        </td>
                        <td className="pe-col-total" style={{ position: "relative" }}>
                          <span>₦{Number(item.total || 0).toLocaleString()}</span>
                          {canCustomize && lineItems.length > 1 && (
                            <button
                              type="button"
                              className="pe-no-print"
                              onClick={() => handleRemoveLineItem(idx)}
                              style={{
                                position: "absolute",
                                right: "2px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "#fee2e2",
                                border: "none",
                                color: "#dc2626",
                                borderRadius: "4px",
                                padding: "2px 5px",
                                cursor: "pointer",
                                fontSize: "0.7rem",
                              }}
                              title="Remove line item"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Blank Ruled Rows to match the PDF sheet layout */}
                    {Array.from({ length: emptyRowCount }).map((_, idx) => (
                      <tr key={`blank-${idx}`} className="pe-blank-row">
                        <td className="pe-col-product">&nbsp;</td>
                        <td className="pe-col-qty">&nbsp;</td>
                        <td className="pe-col-price">&nbsp;</td>
                        <td className="pe-col-total">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {canCustomize && (
                  <div className="pe-no-print" style={{ marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#f1f5f9",
                        border: "1px dashed #64748b",
                        color: "#0f172a",
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={13} />
                      <span>Add Product Row</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 5. PAYMENT METHOD (LEFT) & GRAND TOTAL (RIGHT) */}
              <div className="pe-payment-total-row">
                {/* Payment Method Details */}
                <div className="pe-payment-box">
                  <div className="pe-payment-heading">PAYMENT METHOD</div>

                  {canCustomize ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <input
                        type="text"
                        className="pe-edit-input"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Bank Name"
                      />
                      <input
                        type="text"
                        className="pe-edit-input"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Account Name"
                      />
                      <input
                        type="text"
                        className="pe-edit-input"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="Account Number"
                      />
                    </div>
                  ) : (
                    <div className="pe-payment-lines">
                      <div>Bank: {bankName}</div>
                      <div>Name: {accountName}</div>
                      <div>Account Number: {accountNumber}</div>
                    </div>
                  )}
                </div>

                {/* Total Block */}
                <div className="pe-grand-total-box">
                  <span className="pe-grand-total-label">Total</span>
                  <span className="pe-grand-total-amount">
                    ₦{grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 6. TERMS & CONDITIONS */}
              <div className="pe-terms-block">
                <div className="pe-terms-title">Terms &amp; Conditions.</div>
                <div className="pe-terms-body">
                  <div>By accepting delivery or making payment, the Buyer agrees that:</div>
                  <div>(1) consumable goods received in good condition cannot be returned;</div>
                  <div>(2) all payments are non-refundable;</div>
                  <div>
                    (3) claims for damaged, defective, or incorrect goods must be made in
                  </div>
                  <div>writing within 48 hours of delivery, failing which they are waived</div>
                </div>
              </div>
            </div>

            {/* 7. NAVY / ROYAL BLUE FOOTER BAR */}
            <div className="pe-footer-navy-bar">
              <div className="pe-footer-contact-item">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  <path d="M14.05 2a9 9 0 0 1 8 7.94" />
                  <path d="M14.05 6A5 5 0 0 1 18 10" />
                </svg>
                <span>234-707-1739697</span>
              </div>

              <div className="pe-footer-contact-item">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>12a Kudirat Abiola way, Alausa Ikeja, Lagos Nigeria</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar (Non-Printed) */}
        <div className="pe-modal-action-footer pe-no-print">
          <div style={{ fontSize: "0.78rem", color: "#475569" }}>
            Sales Rep: <strong style={{ color: "#0f172a" }}>{sale.staff || "Direct Rep"}</strong> • Status:{" "}
            <strong
              style={{
                color:
                  sale.payment_status === 2
                    ? "#059669"
                    : sale.payment_status === 1
                    ? "#d97706"
                    : "#dc2626",
              }}
            >
              {sale.payment_status === 2
                ? "Paid"
                : sale.payment_status === 1
                ? "Partially Paid"
                : "Credit (Unpaid)"}
            </strong>
          </div>

          <div className="pe-action-buttons-group">
            <button
              type="button"
              className="receipt-btn receipt-print-btn"
              onClick={handlePrintInvoice}
            >
              <Printer size={15} />
              <span>Print / Save PDF</span>
            </button>

            {isAdmin && onEditSale && (
              <button
                type="button"
                className="receipt-btn"
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
                onClick={() => {
                  onClose();
                  onEditSale(sale);
                }}
                title="Edit sale transaction"
              >
                <Pencil size={14} />
                <span>Edit</span>
              </button>
            )}

            {isAdmin && onDeleteSale && (
              <button
                type="button"
                className="receipt-btn"
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
                onClick={() => onDeleteSale(sale)}
                title="Delete sale transaction"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              className="receipt-btn receipt-done-btn"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
