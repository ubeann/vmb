CREATE TABLE "master"."permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	CONSTRAINT "master_permissions_resource_action_unique" UNIQUE("resource","action"),
	CONSTRAINT "permissions_key_check" CHECK ("master"."permissions"."key" = "master"."permissions"."resource" || '.' || "master"."permissions"."action")
);
--> statement-breakpoint
CREATE TABLE "master"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "master"."user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "master"."roles" ADD COLUMN "division_id" uuid;--> statement-breakpoint
ALTER TABLE "master"."role_permissions" ADD CONSTRAINT "master_role_permissions_role_id_foreign" FOREIGN KEY ("role_id") REFERENCES "master"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master"."role_permissions" ADD CONSTRAINT "master_role_permissions_permission_key_foreign" FOREIGN KEY ("permission_key") REFERENCES "master"."permissions"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "master"."user_roles" ADD CONSTRAINT "master_user_roles_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "master"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master"."user_roles" ADD CONSTRAINT "master_user_roles_role_id_foreign" FOREIGN KEY ("role_id") REFERENCES "master"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "master_role_permissions_permission_key_index" ON "master"."role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE INDEX "master_user_roles_role_id_index" ON "master"."user_roles" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "master"."roles" ADD CONSTRAINT "master_roles_division_id_foreign" FOREIGN KEY ("division_id") REFERENCES "master"."divisions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "master_roles_division_id_index" ON "master"."roles" USING btree ("division_id" uuid_ops);