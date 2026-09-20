ALTER TABLE "public"."account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp (3) with time zone USING "access_token_expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp (3) with time zone USING "refresh_token_expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."account" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp (3) with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."session" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."user" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp (3) with time zone USING "expires_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "public"."verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "expense"."approvals" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."approvals" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."budgets" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."budgets" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."request_emergency_details" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."request_emergency_details" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."request_niche_details" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."request_niche_details" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."requests" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."requests" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "expense"."requests" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."divisions" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."divisions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."divisions" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."users" ALTER COLUMN "email_verified_at" SET DATA TYPE timestamp (3) with time zone USING "email_verified_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."users" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "master"."users" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."approvals" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."approvals" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."client_route" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."client_route" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."client_truck_companies" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."client_truck_companies" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."clients" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."clients" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."clients" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."daily_trucking_actuals" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."daily_trucking_actuals" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."daily_trucking_actuals" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."daily_trucking_plans" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."daily_trucking_plans" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."daily_trucking_plans" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."drivers" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."drivers" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."drivers" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoice_comments" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoice_comments" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoice_shipments" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoice_shipments" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoice_vendor" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoice_vendor" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoices" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoices" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."invoices" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."locations" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."locations" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ALTER COLUMN "cancelled_at" SET DATA TYPE timestamp (3) with time zone USING "cancelled_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ALTER COLUMN "submitted_for_payment_at" SET DATA TYPE timestamp (3) with time zone USING "submitted_for_payment_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ALTER COLUMN "payment_received_at" SET DATA TYPE timestamp (3) with time zone USING "payment_received_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."route_locations" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."route_locations" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."routes" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."routes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."trips" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."trips" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."trucks" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."trucks" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "trucking"."trucks" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp (3) with time zone USING "deleted_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."approvals" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."approvals" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."items" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."items" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_quotations" ALTER COLUMN "payment_date" SET DATA TYPE timestamp (3) with time zone USING "payment_date" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_quotations" ALTER COLUMN "receipt_date" SET DATA TYPE timestamp (3) with time zone USING "receipt_date" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_quotations" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_quotations" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_requests" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_requests" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."procurement_requests" ALTER COLUMN "completed_at" SET DATA TYPE timestamp (3) with time zone USING "completed_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."stock_alerts" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."stock_alerts" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."stock_requisitions" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone USING "created_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."stock_requisitions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone USING "updated_at" AT TIME ZONE 'Asia/Jakarta';
--> statement-breakpoint
ALTER TABLE "warehouse"."stock_requisitions" ALTER COLUMN "completed_at" SET DATA TYPE timestamp (3) with time zone USING "completed_at" AT TIME ZONE 'Asia/Jakarta';
