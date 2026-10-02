import { seedCatalog } from "../src/server/db/seed-data";
import {
  selectExplorationEvent,
  explorationWeightsForRoute,
  explorationChance,
} from "../src/game/exploration/rules";
let state = 19286;
const random = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 4294967296;
};
const context = {
  character: {
    level: 100,
    raceId: "humano",
    flags: [],
    hp: 100,
    ki: 100,
    zeni: 100,
    equipment: {},
  },
  powerLevel: 100000,
  inventory: [],
  items: seedCatalog.items,
  maxHp: 100,
};
const rows = seedCatalog.areas.map((area) => {
  const count: Record<string, number> = {};
  for (let index = 0; index < 10000; index++) {
    const event = selectExplorationEvent(seedCatalog.explorationEvents, area.id, context, random);
    count[event.category] = (count[event.category] ?? 0) + 1;
  }
  return {
    area: area.id,
    coleta: count.gather / 100,
    npc: count.npc / 100,
    perigo: count.danger / 100,
    tesouro: count.treasure / 100,
    descoberta: count.discovery / 100,
    excepcional: count.exceptional / 100,
  };
});
console.table(rows);
console.log(
  "160 mil saídas simuladas. As porcentagens são frequências de ocorrência, não garantias de recompensa.",
);
console.log(
  "Limite teórico de coleta segura na trilha principal: 1,75 materiais/minuto sem kit; 3/minuto com kit. Nenhum XP ou Zeni repetível nesse percurso seguro.",
);
console.log(
  "Custo do mapa: 3 materiais para ajudar + 6 para fabricar + 20–92 Zeni. Bônus máximo +10 pontos percentuais, sem empilhar.",
);
console.log(
  "Para atributo igual ao alvo, testes têm",
  explorationChance(10, 10),
  "% de sucesso. Caminho: uma tentativa a cada ~267s; excepcional: ~2400s, antes do teste.",
);
console.log(
  "XP máximo de descobertas permanentes (todos os 16 NPCs e caminhos): 480. Combates mantêm suas próprias recompensas e custos.",
);
console.log("Rota descoberta:", explorationWeightsForRoute(seedCatalog.explorationRoutes[0]));
