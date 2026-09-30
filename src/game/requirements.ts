import type { Requirements } from "./types";

export type RequirementContext = {
  level: number;
  powerLevel: number;
  raceId: string;
  flags: string[];
};
export function unmetRequirements(req: Requirements, context: RequirementContext): string[] {
  const reasons: string[] = [];
  if (req.minLevel && context.level < req.minLevel) reasons.push(`Nível ${req.minLevel}`);
  if (req.minPower && context.powerLevel < req.minPower)
    reasons.push(`Power Level ${req.minPower}`);
  if (req.raceIds?.length && !req.raceIds.includes(context.raceId))
    reasons.push("Raça incompatível");
  if (req.masterId && !context.flags.includes(`master:${req.masterId}`))
    reasons.push(`Treinamento com ${req.masterId}`);
  for (const flag of req.flags ?? [])
    if (!context.flags.includes(flag)) reasons.push(`Conquista: ${flag}`);
  return reasons;
}
