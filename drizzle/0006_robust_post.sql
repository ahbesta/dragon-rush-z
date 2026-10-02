ALTER TABLE "trainings" ALTER COLUMN "xp_per_minute" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "xp_per_hour" integer;--> statement-breakpoint
ALTER TABLE "trainings" ADD COLUMN "base_xp_per_hour" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "trainings" ADD COLUMN "level_rate_percent" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activity_training_hourly_rate" CHECK ("activities"."xp_per_hour" IS NULL OR "activities"."xp_per_hour" BETWEEN 1 AND 1000000);--> statement-breakpoint
ALTER TABLE "trainings" ADD CONSTRAINT "training_hourly_bounds" CHECK ("trainings"."base_xp_per_hour" BETWEEN 1 AND 10000 AND "trainings"."level_rate_percent" BETWEEN 0 AND 100);
--> statement-breakpoint
UPDATE trainings SET base_xp_per_hour = CASE id WHEN 'kame-basic' THEN 20 WHEN 'kame-weights' THEN 30 WHEN 'karin' THEN 45 WHEN 'popo' THEN 60 END,
level_rate_percent = CASE id WHEN 'kame-basic' THEN 3 WHEN 'kame-weights' THEN 4 WHEN 'karin' THEN 6 WHEN 'popo' THEN 8 END,
xp_per_minute = 1 WHERE id IN ('kame-basic', 'kame-weights', 'karin', 'popo');
--> statement-breakpoint
-- Convert any pending sessions from the unreleased per-minute version to the balanced hourly rule.
-- Old thirty-second sessions have no training_id and retain their original completion behavior.
UPDATE activities a SET xp_per_hour = GREATEST(t.base_xp_per_hour, ((100 + 50 * (c.level - 1)) * t.level_rate_percent) / 100), xp_per_minute = NULL
FROM trainings t, characters c
WHERE a.training_id = t.id AND a.character_id = c.id AND a.kind = 'training' AND a.completed_at IS NULL AND a.xp_per_hour IS NULL;
