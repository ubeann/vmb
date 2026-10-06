ALTER TABLE "master"."divisions" DROP CONSTRAINT "master_divisions_name_unique";--> statement-breakpoint
ALTER TABLE "master"."divisions" DROP CONSTRAINT "master_divisions_code_unique";--> statement-breakpoint
ALTER TABLE "master"."roles" DROP CONSTRAINT "master_roles_name_guard_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "master_divisions_name_unique" ON "master"."divisions" USING btree (lower("name")) WHERE "master"."divisions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "master_divisions_code_unique" ON "master"."divisions" USING btree (lower("code")) WHERE "master"."divisions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "master_roles_name_unique" ON "master"."roles" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "master"."roles" DROP COLUMN "guard_name";--> statement-breakpoint
ALTER TABLE "master"."roles" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "master"."roles" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "master"."users" DROP COLUMN "email_verified_at";--> statement-breakpoint
ALTER TABLE "master"."divisions" ADD CONSTRAINT "divisions_color_hex_check" CHECK ("master"."divisions"."color_hex" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "master"."roles" ADD CONSTRAINT "roles_color_hex_check" CHECK ("master"."roles"."color_hex" ~ '^#[0-9A-Fa-f]{6}$');