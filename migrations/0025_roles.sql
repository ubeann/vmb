CREATE TABLE "master"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"guard_name" varchar(255) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"color_hex" varchar(255) DEFAULT '#000000' NOT NULL,
	"icon_name" varchar(255) DEFAULT 'heroicon-o-rocket-launch' NOT NULL,
	"description" varchar(255),
	"metadata" json,
	"created_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone,
	CONSTRAINT "master_roles_name_guard_name_unique" UNIQUE("name","guard_name")
);
