import { ID_GROUPS, id, stamps } from "../ids.js";
import { table } from "../sql.js";
import { PREVIEW_USER_ID } from "./master.js";

/**
 * The warehouse half of the preview dataset: items with stock levels that
 * cross their reorder threshold, procurement requests covering every workflow
 * status (with a quotation for the later ones), stock requisitions in every
 * state, and the alerts and approvals that hang off them.
 */

const itemSeed = [
  { name: "Container Seal", code: "IT-001", stock: 480, reorder: 200 },
  { name: "Wooden Pallet", code: "IT-002", stock: 160, reorder: 120 },
  { name: "Strapping Band", code: "IT-003", stock: 90, reorder: 150 },
  { name: "Wheel Chock", code: "IT-004", stock: 60, reorder: 40 },
  { name: "Tarpaulin", code: "IT-005", stock: 35, reorder: 50 },
  { name: "Nylon Rope", code: "IT-006", stock: 210, reorder: 100 },
  { name: "Safety Gloves", code: "IT-007", stock: 320, reorder: 250 },
  { name: "Safety Helmet", code: "IT-008", stock: 75, reorder: 100 },
  { name: "Diesel Jerry Can", code: "IT-009", stock: 48, reorder: 60 },
  { name: "Lashing Belt", code: "IT-010", stock: 140, reorder: 90 },
  { name: "Cargo Net", code: "IT-011", stock: 28, reorder: 45 },
  { name: "Document Folder", code: "IT-012", stock: 500, reorder: 200 }
];

const items = table(
  "warehouse.items",
  [
    "id",
    "division_id",
    "name",
    "code",
    "description",
    "icon_name",
    "current_stock",
    "reorder_level",
    "created_at",
    "updated_at"
  ],
  itemSeed.map((item, index) => ({
    id: id(ID_GROUPS.item, index + 1),
    division_id: id(ID_GROUPS.division, (index % 12) + 1),
    name: item.name,
    code: item.code,
    description: `${item.name} kept in the central warehouse`,
    icon_name: "heroicon-o-cube",
    current_stock: item.stock,
    reorder_level: item.reorder,
    ...stamps(index + 1)
  }))
);

const quotations = table(
  "warehouse.procurement_quotations",
  [
    "id",
    "quoted_price",
    "vendor_name",
    "vendor_website",
    "vendor_phone",
    "invoice_url",
    "invoice_file_path",
    "payment_account",
    "payment_proof_path",
    "payment_date",
    "receipt_proof_path",
    "receipt_date",
    "created_at",
    "updated_at"
  ],
  Array.from({ length: 6 }, (_, index) => {
    const quotation = index + 1;
    return {
      id: id(ID_GROUPS.quotation, quotation),
      quoted_price: 4_500_000 + quotation * 350_000,
      vendor_name: `PT Sumber Teknik ${quotation}`,
      vendor_website: `https://sumberteknik${quotation}.example`,
      vendor_phone: `+62 21-5560-${String(quotation).padStart(4, "0")}`,
      invoice_url: `https://sumberteknik${quotation}.example/invoice.pdf`,
      invoice_file_path: `quotations/${quotation}/invoice.pdf`,
      payment_account: `BCA 12345678${String(quotation).padStart(2, "0")}`,
      payment_proof_path: `quotations/${quotation}/payment-proof.pdf`,
      payment_date: `2026-01-${String(quotation + 9).padStart(2, "0")}T03:00:00.000Z`,
      receipt_proof_path: `quotations/${quotation}/receipt.pdf`,
      receipt_date: `2026-01-${String(quotation + 12).padStart(2, "0")}T03:00:00.000Z`,
      ...stamps(quotation)
    };
  })
);

const procurementStatuses = [
  "pending_approval",
  "division_approved",
  "finance_approved",
  "quotation_submitted",
  "budget_transferred",
  "fulfillment_evidence_received",
  "director_approved",
  "rejected",
  "completed"
];

const procurementRequests = table(
  "warehouse.procurement_requests",
  [
    "id",
    "request_number",
    "requester_id",
    "item_id",
    "status",
    "unit_price",
    "requested_quantity",
    "total_amount",
    "justification",
    "quotation_id",
    "created_at",
    "updated_at",
    "completed_at"
  ],
  Array.from({ length: 12 }, (_, index) => {
    const request = index + 1;
    const status = procurementStatuses[index % 9]!;
    const unitPrice = 150_000 + request * 12_500;
    const quantity = (index % 5) + 1;
    // A quotation is attached once the workflow reaches the status that
    // submits one; the unique constraint on quotation_id means each of the six
    // quotations belongs to exactly one request.
    const quoted = index >= 3 && index <= 8;
    return {
      id: id(ID_GROUPS.procurementRequest, request),
      request_number: `PR-2026-${String(request).padStart(4, "0")}`,
      requester_id: index === 0 ? PREVIEW_USER_ID : id(ID_GROUPS.user, (index % 12) + 1),
      item_id: id(ID_GROUPS.item, (index % 12) + 1),
      status,
      unit_price: unitPrice,
      requested_quantity: quantity,
      total_amount: unitPrice * quantity,
      justification: `Replenish stock for ${itemSeed[index % 12]!.name}`,
      quotation_id: quoted ? id(ID_GROUPS.quotation, index - 2) : null,
      completed_at: status === "completed" ? "2026-01-04T08:00:00.000Z" : null,
      ...stamps(request)
    };
  })
);

const requisitionStatuses = ["pending_approval", "division_approved", "rejected", "completed"];

const stockRequisitions = table(
  "warehouse.stock_requisitions",
  [
    "id",
    "requisition_number",
    "requester_id",
    "item_id",
    "status",
    "requested_quantity",
    "stock_on_hand",
    "purpose",
    "created_at",
    "updated_at",
    "completed_at"
  ],
  Array.from({ length: 12 }, (_, index) => {
    const requisition = index + 1;
    const status = requisitionStatuses[index % 4]!;
    const item = itemSeed[index % 12]!;
    return {
      id: id(ID_GROUPS.stockRequisition, requisition),
      requisition_number: `SR-2026-${String(requisition).padStart(4, "0")}`,
      requester_id: index === 0 ? PREVIEW_USER_ID : id(ID_GROUPS.user, (index % 12) + 1),
      item_id: id(ID_GROUPS.item, (index % 12) + 1),
      status,
      requested_quantity: (index % 6) + 2,
      stock_on_hand: item.stock,
      purpose: `Daily draw for ${item.name}`,
      completed_at: status === "completed" ? "2026-01-04T08:30:00.000Z" : null,
      ...stamps(requisition)
    };
  })
);

const stockAlerts = table(
  "warehouse.stock_alerts",
  ["id", "item_id", "last_stock", "last_requisition_id", "created_at", "updated_at"],
  Array.from({ length: 6 }, (_, index) => {
    const alert = index + 1;
    return {
      id: id(ID_GROUPS.stockAlert, alert),
      item_id: id(ID_GROUPS.item, alert),
      last_stock: itemSeed[alert - 1]!.stock,
      // NOT NULL with a SET NULL delete rule, so it must point at a live
      // requisition — these six all exist.
      last_requisition_id: id(ID_GROUPS.stockRequisition, alert),
      ...stamps(alert)
    };
  })
);

const PROCUREMENT_REQUEST_MODEL = "App\\Models\\Warehouse\\ProcurementRequest";
const STOCK_REQUISITION_MODEL = "App\\Models\\Warehouse\\StockRequisition";

const warehouseApprovalSeed = [
  { model: PROCUREMENT_REQUEST_MODEL, target: 1, type: "division" },
  { model: PROCUREMENT_REQUEST_MODEL, target: 1, type: "finance" },
  { model: PROCUREMENT_REQUEST_MODEL, target: 2, type: "division" },
  { model: STOCK_REQUISITION_MODEL, target: 1, type: "division" },
  { model: STOCK_REQUISITION_MODEL, target: 1, type: "finance" },
  { model: STOCK_REQUISITION_MODEL, target: 2, type: "division" }
];

const approvals = table(
  "warehouse.approvals",
  [
    "id",
    "approvable_type",
    "approvable_id",
    "approver_id",
    "type",
    "approved",
    "comment",
    "created_at",
    "updated_at"
  ],
  warehouseApprovalSeed.map((approval, index) => ({
    id: id(ID_GROUPS.warehouseApproval, index + 1),
    approvable_type: approval.model,
    approvable_id:
      approval.model === PROCUREMENT_REQUEST_MODEL
        ? id(ID_GROUPS.procurementRequest, approval.target)
        : id(ID_GROUPS.stockRequisition, approval.target),
    approver_id: index % 2 === 0 ? PREVIEW_USER_ID : id(ID_GROUPS.user, 4),
    type: approval.type,
    approved: true,
    comment: `${approval.type} approval recorded for preview`,
    ...stamps(index + 1)
  }))
);

export const warehouseTables = [
  items,
  quotations,
  procurementRequests,
  stockRequisitions,
  stockAlerts,
  approvals
];
