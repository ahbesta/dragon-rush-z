CREATE TABLE "active_battles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"character_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "active_battles_character_id_unique" UNIQUE("character_id")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "combat_mode" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "active_battles" ADD CONSTRAINT "active_battles_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "character_combat_mode" CHECK ("characters"."combat_mode" IN ('automatic', 'manual'));
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dragon_rush_z_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.active_battles TO dragon_rush_z_runtime;
  END IF;
END $$;
