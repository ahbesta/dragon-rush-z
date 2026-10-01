CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL,
	"min_level" integer NOT NULL,
	"finale_quest_id" text NOT NULL,
	"art" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"objectives" jsonb NOT NULL,
	"rewards" jsonb NOT NULL,
	"next" text
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"settlement_id" text NOT NULL,
	"name" text NOT NULL,
	"output_item_id" text NOT NULL,
	"output_quantity" integer NOT NULL,
	"ingredients" jsonb NOT NULL,
	"zeni_cost" integer NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "recipe_values" CHECK ("recipes"."output_quantity" > 0 AND "recipes"."zeni_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"npc" text NOT NULL,
	"description" text NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"art" text NOT NULL,
	"respec" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"settlement_id" text NOT NULL,
	"item_id" text NOT NULL,
	"price" integer NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "offer_price" CHECK ("shop_offers"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "item_shape";--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "requirements" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "art" text DEFAULT 'floresta' NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "hub" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "rules_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "allocation" jsonb DEFAULT '{"strength":0,"defense":0,"speed":0,"endurance":0,"kiControl":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "respec_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "belt" jsonb DEFAULT '["pocao-hp","pocao-ki","antidoto"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "auto_items" jsonb DEFAULT '{"enabled":false,"hpThreshold":30,"kiThreshold":20,"maxUses":1}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "quest_progress" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "rated_power" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "campaign_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enemies" ADD COLUMN "pattern" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "enemies" ADD COLUMN "heroic_of" text;--> statement-breakpoint
ALTER TABLE "enemies" ADD COLUMN "art_id" text;--> statement-breakpoint
ALTER TABLE "enemies" ADD COLUMN "guaranteed_item" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "sell_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "source" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "affinities" jsonb DEFAULT '{"strength":1,"defense":1,"speed":1,"endurance":1,"kiControl":1}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "ki_base" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "techniques" ADD COLUMN "hp_cost" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_output_item_id_items_id_fk" FOREIGN KEY ("output_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_offers" ADD CONSTRAINT "shop_offers_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_offers" ADD CONSTRAINT "shop_offers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "character_build_values" CHECK ("characters"."rules_version" IN (1,2) AND "characters"."respec_count" >= 0 AND "characters"."rated_power" >= 0 AND "characters"."campaign_order" >= 0);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "item_shape" CHECK (("items"."type" IN ('consumable','material') AND "items"."slot" IS NULL) OR ("items"."type" = 'equipment' AND "items"."slot" IN ('weapon', 'armor', 'boots', 'accessory')));
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dragon_rush_z_runtime') THEN
    GRANT SELECT ON TABLE public.chapters, public.quests, public.recipes, public.settlements, public.shop_offers TO dragon_rush_z_runtime;
  END IF;
END $$;
