import { sql } from "drizzle-orm";
import type { Db } from "./db/client";
export type RankingEntry = {
  position: number;
  name: string;
  raceId: string;
  level: number;
  powerLevel: number;
  chapters: number;
  own: boolean;
};
export async function readRanking(db: Db, userId: string, raceId: string | null) {
  const result = await db.execute<{
    entries: RankingEntry[];
    own: RankingEntry | null;
    total: number;
  }>(sql`
    WITH ranked AS (
      SELECT dense_rank() OVER (ORDER BY rated_power DESC, campaign_order DESC, level DESC)::int AS position,
      name, race_id AS "raceId", level, rated_power AS "powerLevel", campaign_order AS chapters,
      user_id = ${userId} AS own, id
      FROM characters WHERE rules_version=2 AND (${raceId}::text IS NULL OR race_id=${raceId})
    ) SELECT
      COALESCE((SELECT jsonb_agg(row_data) FROM (SELECT position,name,"raceId",level,"powerLevel",chapters,own FROM ranked ORDER BY position,id LIMIT 50) row_data),'[]'::jsonb) AS entries,
      (SELECT jsonb_build_object('position',position,'name',name,'raceId',"raceId",'level',level,'powerLevel',"powerLevel",'chapters',chapters,'own',own) FROM ranked WHERE own) AS own,
      (SELECT count(*)::int FROM ranked) AS total
  `);
  return result.rows[0];
}
