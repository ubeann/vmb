import { ID_GROUPS, id, softStamps, stamps } from "../ids.js";
import { table } from "../sql.js";
import { PREVIEW_USER_ID } from "./master.js";

/**
 * The expense half of the preview dataset: one budget per division (the table
 * allows exactly one), expense requests in every workflow state — both NICHE
 * and EMERGENCY variants — and the finance approval the legacy app records for
 * the approved ones.
 */

const budgets = table(
  "expense.budgets",
  ["id", "division_id", "is_active", "amount", "created_at", "updated_at"],
  Array.from({ length: 12 }, (_, index) => {
    const budget = index + 1;
    return {
      id: id(ID_GROUPS.budget, budget),
      division_id: id(ID_GROUPS.division, budget),
      is_active: budget !== 11,
      amount: 25_000_000 + budget * 2_500_000,
      ...stamps(budget)
    };
  })
);

const requestStatuses = [
  "PENDING",
  "WAITING_FOR_SUPPORTING_DOCUMENTS",
  "SUBMITTING_SUPPORTING_DOCUMENTS",
  "COMPLETED",
  "REJECTED"
];

const requests = table(
  "expense.requests",
  ["id", "user_id", "division_id", "type", "status", "created_at", "updated_at", "deleted_at"],
  Array.from({ length: 12 }, (_, index) => {
    const request = index + 1;
    const type = request % 2 === 1 ? "NICHE" : "EMERGENCY";
    return {
      id: id(ID_GROUPS.expenseRequest, request),
      user_id: index === 0 ? PREVIEW_USER_ID : id(ID_GROUPS.user, (index % 12) + 1),
      division_id: id(ID_GROUPS.division, (index % 12) + 1),
      type,
      status: requestStatuses[index % 5]!,
      // One soft-deleted row, so a preview's default list has something to
      // filter out.
      ...softStamps(request, request === 12 ? "2026-01-04T07:00:00.000Z" : null)
    };
  })
);

const nicheDetails = table(
  "expense.request_niche_details",
  [
    "id",
    "request_id",
    "amount",
    "notes",
    "supporting_documents",
    "invoice_paths",
    "bank_transfer_proof",
    "created_at",
    "updated_at"
  ],
  Array.from({ length: 6 }, (_, index) => {
    const detail = index + 1;
    const request = index * 2 + 1;
    return {
      id: id(ID_GROUPS.nicheDetail, detail),
      request_id: id(ID_GROUPS.expenseRequest, request),
      amount: 1_750_000 + detail * 125_000,
      notes: `Regular expense ${detail}: office and operational needs`,
      supporting_documents: { json: [`expense/${request}/supporting-${detail}.pdf`] },
      invoice_paths: { json: [`expense/${request}/invoice-${detail}.pdf`] },
      bank_transfer_proof: `expense/${request}/transfer-proof-${detail}.pdf`,
      ...stamps(detail)
    };
  })
);

const emergencyDetails = table(
  "expense.request_emergency_details",
  [
    "id",
    "request_id",
    "category",
    "amount",
    "budget_usage",
    "notes",
    "supporting_documents",
    "invoice_paths",
    "bank_transfer_proof",
    "created_at",
    "updated_at"
  ],
  Array.from({ length: 6 }, (_, index) => {
    const detail = index + 1;
    const request = index * 2 + 2;
    return {
      id: id(ID_GROUPS.emergencyDetail, detail),
      request_id: id(ID_GROUPS.expenseRequest, request),
      category: String((index % 5) + 1),
      amount: 3_500_000 + detail * 250_000,
      budget_usage: `Drawn from the ${index % 2 === 0 ? "division" : "central"} budget`,
      notes: `Emergency expense ${detail}: unplanned operational cost`,
      supporting_documents: { json: [`expense/${request}/supporting-${detail}.pdf`] },
      invoice_paths: { json: [`expense/${request}/invoice-${detail}.pdf`] },
      bank_transfer_proof: `expense/${request}/transfer-proof-${detail}.pdf`,
      ...stamps(detail)
    };
  })
);

/** Legacy records only the finance step on expense requests, so every seeded approval is `finance`. */
const REQUEST_MODEL = "App\\Models\\Expense\\Request";

const approvals = table(
  "expense.approvals",
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
  Array.from({ length: 6 }, (_, index) => {
    const approval = index + 1;
    return {
      id: id(ID_GROUPS.expenseApproval, approval),
      approvable_type: REQUEST_MODEL,
      approvable_id: id(ID_GROUPS.expenseRequest, approval),
      approver_id: index % 2 === 0 ? PREVIEW_USER_ID : id(ID_GROUPS.user, 5),
      type: "finance",
      approved: approval !== 5,
      comment: approval === 5 ? "Budget line exhausted" : "Finance approved for preview",
      ...stamps(approval)
    };
  })
);

export const expenseTables = [budgets, requests, nicheDetails, emergencyDetails, approvals];
