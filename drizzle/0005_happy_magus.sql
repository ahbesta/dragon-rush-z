CREATE TABLE "trainings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"master_id" text NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"art_id" text NOT NULL,
	"xp_per_minute" integer NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "training_rate_bounds" CHECK ("trainings"."xp_per_minute" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "training_id" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "xp_per_minute" integer;--> statement-breakpoint
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_master_id_masters_id_fk" FOREIGN KEY ("master_id") REFERENCES "public"."masters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_training_id_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activity_training_rate" CHECK ("activities"."xp_per_minute" IS NULL OR "activities"."xp_per_minute" BETWEEN 1 AND 10000);
--> statement-breakpoint
INSERT INTO masters (id, name, available) VALUES ('kame', 'Mestre Kame', true), ('karin', 'Karin', true), ('popo', 'Mr. Popo', true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO trainings (id, name, master_id, location, description, art_id, xp_per_minute, requirements, sort_order) VALUES
('kame-basic', 'Entrega de leite', 'kame', 'Kame House', 'Corrida, disciplina e entregas de leite. O primeiro passo da Escola Tartaruga.', 'kame', 60, '{}', 1),
('kame-weights', 'Casco pesado', 'kame', 'Ilha do Mestre Kame', 'Leve a disciplina de Kame além do limite com o peso do casco de tartaruga.', 'kame', 90, '{"minLevel":5,"masterId":"kame","flags":["quest:prova-kame","defeated:prova-kame"]}', 2),
('karin', 'Reflexos de Karin', 'karin', 'Torre de Karin', 'Alcance a água sagrada. Karin exige velocidade, percepção e persistência.', 'karin', 150, '{"minLevel":15,"masterId":"karin","flags":["quest:karin","defeated:prova-karin"]}', 3),
('popo', 'Silêncio e controle de Ki', 'popo', 'Templo de Kami', 'Mr. Popo ensina a sentir o Ki e dominar cada movimento sem desperdiçar energia.', 'popo', 240, '{"minLevel":25,"flags":["quest:daimao","defeated:piccolo-daimao"]}', 4)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dragon_rush_z_runtime') THEN
    GRANT SELECT ON trainings TO dragon_rush_z_runtime;
  END IF;
END $$;
