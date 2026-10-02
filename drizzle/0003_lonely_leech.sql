CREATE TABLE "exploration_events" (
	"id" text PRIMARY KEY NOT NULL,
	"area_id" text NOT NULL,
	"definition" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exploration_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"area_id" text NOT NULL,
	"definition" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exploration_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"character_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "exploration_events" ADD CONSTRAINT "exploration_events_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_routes" ADD CONSTRAINT "exploration_routes_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exploration_sessions" ADD CONSTRAINT "exploration_sessions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_exploration" ON "exploration_sessions" USING btree ("character_id") WHERE "exploration_sessions"."completed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "exploration_character_history" ON "exploration_sessions" USING btree ("character_id","started_at");