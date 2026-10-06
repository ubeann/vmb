ALTER TABLE "master"."users" DROP CONSTRAINT "master_users_division_id_foreign";
--> statement-breakpoint
DROP INDEX "master"."master_users_division_id_index";--> statement-breakpoint
ALTER TABLE "master"."users" DROP COLUMN "division_id";