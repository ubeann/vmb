ALTER TABLE "trucking"."orders" DROP CONSTRAINT "trucking_orders_client_id_foreign";
--> statement-breakpoint
ALTER TABLE "trucking"."orders" ADD CONSTRAINT "trucking_orders_client_id_foreign" FOREIGN KEY ("client_id") REFERENCES "trucking"."clients"("id") ON DELETE restrict ON UPDATE cascade;