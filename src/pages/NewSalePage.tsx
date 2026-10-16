import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewSaleDialog } from "./sales/NewSaleDialog";

/**
 * Full-page route for recording a sale (kept for /sales/new and /new-sale).
 * Renders the same draggable dialog used on the Sales page.
 */
export default function NewSale() {
  const navigate = useNavigate();
  const [savedMessage, setSavedMessage] = useState("");

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>New Sale</h2>
          <p>Record a new sales transaction.</p>
        </div>
      </div>

      {savedMessage && (
        <div className="new-sale-success" role="status">
          <span>{savedMessage}</span>
        </div>
      )}

      <NewSaleDialog
        onSaved={setSavedMessage}
        onClose={() => navigate("/sales")}
      />
    </div>
  );
}
