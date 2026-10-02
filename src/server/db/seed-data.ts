import { seedCatalog as classic } from "./classic-catalog";
import { explorationContent } from "./exploration-catalog";
export const explorationSeed = explorationContent(classic);
export const seedCatalog = {
  ...classic,
  items: [...classic.items, ...explorationSeed.items],
  recipes: [...classic.recipes, ...explorationSeed.recipes],
  policies: [...classic.policies, explorationSeed.policy],
  explorationEvents: explorationSeed.events,
  explorationRoutes: explorationSeed.routes,
};
