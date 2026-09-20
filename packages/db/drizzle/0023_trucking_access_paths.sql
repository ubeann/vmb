DROP INDEX "trucking"."trucking_client_truck_companies_client_id_index";--> statement-breakpoint
DROP INDEX "trucking"."trucking_orders_status_index";--> statement-breakpoint
DROP INDEX "trucking"."trucking_trips_order_id_index";--> statement-breakpoint
CREATE INDEX "trucking_approvals_type_created_at_index" ON "trucking"."approvals" USING btree ("type" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "trucking_approvals_approver_id_index" ON "trucking"."approvals" USING btree ("approver_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trucking_daily_trucking_actuals_driver_id_index" ON "trucking"."daily_trucking_actuals" USING btree ("driver_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trucking_daily_trucking_plans_driver_id_index" ON "trucking"."daily_trucking_plans" USING btree ("driver_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trucking_invoice_vendor_invoice_id_index" ON "trucking"."invoice_vendor" USING btree ("invoice_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trucking_invoices_client_id_status_index" ON "trucking"."invoices" USING btree ("client_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "trucking_orders_status_created_at_index" ON "trucking"."orders" USING btree ("status" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "trucking_orders_reference_id_index" ON "trucking"."orders" USING btree ("reference_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "trucking_orders_cancelled_by_index" ON "trucking"."orders" USING btree ("cancelled_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "trucking_trips_route_reference_id_index" ON "trucking"."trips" USING btree ("route_reference_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "trucking"."client_truck_companies" ADD CONSTRAINT "trucking_client_truck_companies_client_id_name_unique" UNIQUE("client_id","name");--> statement-breakpoint
ALTER TABLE "trucking"."trips" ADD CONSTRAINT "trucking_trips_order_id_code_unique" UNIQUE("order_id","code");