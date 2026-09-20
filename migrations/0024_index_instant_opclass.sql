DROP INDEX "expense"."expense_requests_division_id_status_created_at_index";--> statement-breakpoint
DROP INDEX "trucking"."trucking_invoice_comments_invoice_id_created_at_index";--> statement-breakpoint
DROP INDEX "warehouse"."warehouse_procurement_requests_status_created_at_index";--> statement-breakpoint
DROP INDEX "warehouse"."warehouse_stock_requisitions_status_created_at_index";--> statement-breakpoint
CREATE INDEX "expense_requests_division_id_status_created_at_index" ON "expense"."requests" USING btree ("division_id" uuid_ops,"status" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "trucking_invoice_comments_invoice_id_created_at_index" ON "trucking"."invoice_comments" USING btree ("invoice_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "warehouse_procurement_requests_status_created_at_index" ON "warehouse"."procurement_requests" USING btree ("status" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "warehouse_stock_requisitions_status_created_at_index" ON "warehouse"."stock_requisitions" USING btree ("status" text_ops,"created_at" timestamptz_ops);