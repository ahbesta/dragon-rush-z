CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"duration_seconds" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	CONSTRAINT "policy_values" CHECK ("action_policies"."duration_seconds" > 0 AND "action_policies"."xp_reward" >= 0)
);
--> statement-breakpoint
CREATE TABLE "action_receipts" (
	"user_id" text NOT NULL,
	"key" uuid NOT NULL,
	"hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_receipts_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finishes_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"planet" text NOT NULL,
	"min_level" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"character_id" uuid NOT NULL,
	"enemy_id" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"race_id" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"zeni" integer DEFAULT 50 NOT NULL,
	"hp" integer NOT NULL,
	"ki" integer NOT NULL,
	"base" jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected_techniques" jsonb DEFAULT '["chute","soco"]'::jsonb NOT NULL,
	"next_battle_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "character_values" CHECK ("characters"."level" >= 1 AND "characters"."xp" >= 0 AND "characters"."zeni" >= 0 AND "characters"."hp" >= 0 AND "characters"."ki" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enemy_drops" (
	"enemy_id" text NOT NULL,
	"item_id" text NOT NULL,
	"chance" double precision NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "enemy_drops_enemy_id_item_id_pk" PRIMARY KEY("enemy_id","item_id"),
	CONSTRAINT "drop_bounds" CHECK ("enemy_drops"."chance" BETWEEN 0 AND 1 AND "enemy_drops"."min_quantity" > 0 AND "enemy_drops"."max_quantity" >= "enemy_drops"."min_quantity")
);
--> statement-breakpoint
CREATE TABLE "area_enemies" (
	"area_id" text NOT NULL,
	"enemy_id" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "area_enemies_area_id_enemy_id_pk" PRIMARY KEY("area_id","enemy_id"),
	CONSTRAINT "positive_weight" CHECK ("area_enemies"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "enemies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"level" integer NOT NULL,
	"attributes" jsonb NOT NULL,
	"max_hp" integer NOT NULL,
	"max_ki" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	"zeni_reward" integer NOT NULL,
	"boss" boolean DEFAULT false NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"technique_ids" jsonb NOT NULL,
	"phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "enemy_values" CHECK ("enemies"."max_hp" > 0 AND "enemies"."max_ki" >= 0 AND "enemies"."xp_reward" >= 0 AND "enemies"."zeni_reward" >= 0)
);
--> statement-breakpoint
CREATE TABLE "history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"character_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "inventory_character_id_item_id_pk" PRIMARY KEY("character_id","item_id"),
	CONSTRAINT "inventory_positive" CHECK ("inventory"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text NOT NULL,
	"slot" text,
	"effects" jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "item_shape" CHECK (("items"."type" = 'consumable' AND "items"."slot" IS NULL) OR ("items"."type" = 'equipment' AND "items"."slot" IN ('weapon', 'armor', 'accessory')))
);
--> statement-breakpoint
CREATE TABLE "character_techniques" (
	"character_id" uuid NOT NULL,
	"technique_id" text NOT NULL,
	"learned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_techniques_character_id_technique_id_pk" PRIMARY KEY("character_id","technique_id")
);
--> statement-breakpoint
CREATE TABLE "masters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"available" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"trait" text NOT NULL,
	"color" text NOT NULL,
	"base" jsonb NOT NULL,
	"growth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "techniques" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"multiplier" double precision NOT NULL,
	"ki_cost" integer NOT NULL,
	"cooldown" integer NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"learn_cost" integer NOT NULL,
	"effects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "technique_values" CHECK ("techniques"."ki_cost" >= 0 AND "techniques"."cooldown" >= 0 AND "techniques"."multiplier" > 0 AND "techniques"."learn_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transformations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"requirements" jsonb NOT NULL,
	"multiplier" double precision NOT NULL,
	"available" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_transformations" (
	"character_id" uuid NOT NULL,
	"transformation_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_transformations_character_id_transformation_id_pk" PRIMARY KEY("character_id","transformation_id")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_receipts" ADD CONSTRAINT "action_receipts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_enemy_id_enemies_id_fk" FOREIGN KEY ("enemy_id") REFERENCES "public"."enemies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enemy_drops" ADD CONSTRAINT "enemy_drops_enemy_id_enemies_id_fk" FOREIGN KEY ("enemy_id") REFERENCES "public"."enemies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enemy_drops" ADD CONSTRAINT "enemy_drops_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_enemies" ADD CONSTRAINT "area_enemies_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_enemies" ADD CONSTRAINT "area_enemies_enemy_id_enemies_id_fk" FOREIGN KEY ("enemy_id") REFERENCES "public"."enemies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_techniques" ADD CONSTRAINT "character_techniques_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_techniques" ADD CONSTRAINT "character_techniques_technique_id_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."techniques"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_transformations" ADD CONSTRAINT "character_transformations_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_transformations" ADD CONSTRAINT "character_transformations_transformation_id_transformations_id_fk" FOREIGN KEY ("transformation_id") REFERENCES "public"."transformations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "auth_account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "receipt_date_idx" ON "action_receipts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_activity" ON "activities" USING btree ("character_id") WHERE "activities"."completed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "battle_history_idx" ON "battles" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE INDEX "history_character_idx" ON "history" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "auth_session" USING btree ("user_id");