import { seedCatalog as classic } from "./classic-catalog";
import { explorationContent } from "./exploration-catalog";
import { trainingCatalog } from "./training-catalog";
export const explorationSeed = explorationContent(classic);
export const seedCatalog = {
  ...classic,
  trainings: trainingCatalog,
  masters: [...classic.masters, { id: "popo", name: "Mr. Popo", available: true }],
  items: [...classic.items, ...explorationSeed.items],
  recipes: [...classic.recipes, ...explorationSeed.recipes],
  policies: [...classic.policies, explorationSeed.policy],
  explorationEvents: explorationSeed.events,
  explorationRoutes: explorationSeed.routes,
};
