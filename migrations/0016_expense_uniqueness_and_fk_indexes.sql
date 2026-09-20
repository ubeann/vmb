CREATE INDEX "expense_approvals_approver_id_index" ON "expense"."approvals" USING btree ("approver_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "expense_requests_division_id_status_created_at_index" ON "expense"."requests" USING btree ("division_id" uuid_ops,"status" text_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "expense_requests_user_id_index" ON "expense"."requests" USING btree ("user_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "expense"."budgets" ADD CONSTRAINT "expense_budgets_division_id_unique" UNIQUE("division_id");--> statement-breakpoint
ALTER TABLE "expense"."request_emergency_details" ADD CONSTRAINT "expense_request_emergency_details_request_id_unique" UNIQUE("request_id");--> statement-breakpoint
ALTER TABLE "expense"."request_niche_details" ADD CONSTRAINT "expense_request_niche_details_request_id_unique" UNIQUE("request_id");