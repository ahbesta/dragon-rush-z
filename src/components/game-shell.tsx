"use client";
import { EquipmentComparison } from "./equipment-comparison";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Dumbbell,
  Flame,
  Heart,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  Store,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import type { ActionPayload } from "@/game/validation";
import type { GameSnapshot, Requirements } from "@/game/types";
import { unmetRequirements } from "@/game/requirements";
import { authClient } from "@/lib/auth-client";
import { Brand, DragonBall, RaceEmblem } from "./brand";
import { formatNumber as n, ItemEffects, ItemIcon, Meter } from "./game-primitives";
import { BattleDestinations } from "./battle-destinations";
import { CombatModeSelector } from "./combat-controls";
import { ExplorationPanel } from "./exploration-panel";
import { BattleArena } from "./battle-arena";
import { GameLobby } from "./game-lobby";
import { transformationArtwork, destinationArtwork, techniqueArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
import { EnemyPortrait } from "./enemy-portrait";
import { ActivityAnimation } from "./activity-animation";
import { BuildPanel } from "./build-panel";
import { AdventurePanel } from "./adventure-panel";
import { SettlementPanel } from "./settlement-panel";
import { RankingPanel } from "./ranking-panel";
import { PreparationPanel } from "./preparation-panel";
import { HeroicPanel } from "./enemy-intel";
import { BattleNavigationNotice } from "./battle-navigation-notice";
import { sortItemsByRarity } from "@/lib/item-presentation";
import { FighterAttributes } from "./fighter-attributes";
import { QuestCompletionNotice } from "./quest-completion-notice";
import { ActivityCompletionNotice } from "./activity-completion-notice";
import { readyQuests } from "@/lib/quest-presentation";
import { explorationBattlePresentation } from "@/lib/exploration-presentation";

const sections = [
  { id: "character", label: "Personagem", icon: UserRound },
  { id: "training", label: "Treinamento", icon: Dumbbell },
  { id: "explore", label: "Explorar", icon: Compass },
  { id: "battle", label: "Batalhar", icon: Swords },
  { id: "quests", label: "Missões", icon: ScrollText },
  { id: "inventory", label: "Inventário", icon: Package },
  { id: "techniques", label: "Técnicas", icon: Zap },
  { id: "settlements", label: "Vilas e mercado", icon: Store },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "transformations", label: "Transformações", icon: Flame },
] as const;
type Section = (typeof sections)[number]["id"];
type ApiResponse = {
  snapshot?: GameSnapshot;
  message?: string;
  error?: { code: string; message: string };
};

export function GameShell({ initial }: { initial: GameSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [dismissedBattleId, setDismissedBattleId] = useState<string | null>(null);
  const [animatedBattleId, setAnimatedBattleId] = useState<string | null>(null);
  const [lootRevealId, setLootRevealId] = useState<string | null>(null);
  const [pendingQuestIds, setPendingQuestIds] = useState<string[]>([]);
  const [focusedQuestIds, setFocusedQuestIds] = useState<string[]>([]);
  const announcedQuests = useRef(new Set(readyQuests(initial).map((quest) => quest.id)));
  const [pendingPresentationId, setPendingPresentationId] = useState<string | null>(null);
  const presentationComplete = useCallback((id: string) => {
    setPendingPresentationId((pending) => (pending === id ? null : pending));
    setLootRevealId((current) => (current === id ? null : current));
  }, []);
  const [dismissedActivityId, setDismissedActivityId] = useState<string | null>(null);
  const [arenaArrivalId, setArenaArrivalId] = useState<string | null>(null);
  const [retainedPageHeight, setRetainedPageHeight] = useState<number | undefined>();
  const arenaAnchor = useRef<HTMLDivElement>(null);
  const lastArrival = useRef<string | null>(null);
  const consumedAnimation = useCallback(() => setAnimatedBattleId(null), []);
  const [section, setSection] = useState<Section>(
    initial.activeExploration ? "explore" : initial.activeBattle ? "battle" : "character",
  );
  const [blockedDestination, setBlockedDestination] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [time, setTime] = useState(() => ({
    server: new Date(initial.serverTime).getTime(),
    client: Date.now(),
  }));
  const [areaId, setAreaId] = useState(() => {
    const battle = initial.activeBattle ?? initial.latestBattle;
    const enemy = initial.catalog.enemies.find((e) => e.id === battle?.enemyId);
    return (
      initial.activeExploration?.areaId ??
      battle?.areaId ??
      initial.catalog.encounters.find((e) => e.enemyId === (enemy?.heroicOf ?? battle?.enemyId))
        ?.areaId ??
      initial.catalog.areas[0]?.id ??
      ""
    );
  });
  const busyRef = useRef(false);
  const refreshGeneration = useRef(0);
  const retryRef = useRef<{ payload: ActionPayload; key: string } | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!arenaArrivalId || lastArrival.current === arenaArrivalId || !arenaAnchor.current) return;
    lastArrival.current = arenaArrivalId;
    const arena = arenaAnchor.current;
    arena.focus({ preventScroll: true });
    arena.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [arenaArrivalId]);
  const adopt = useCallback((next: GameSnapshot) => {
    const availableQuests = readyQuests(next);
    const newlyReady = availableQuests.filter((quest) => !announcedQuests.current.has(quest.id));
    newlyReady.forEach((quest) => announcedQuests.current.add(quest.id));
    setFocusedQuestIds((current) => {
      const remaining = current.filter((id) => availableQuests.some((quest) => quest.id === id));
      return remaining.length === current.length ? current : remaining;
    });
    if (newlyReady.length)
      setPendingQuestIds((pending) => [
        ...new Set([...pending, ...newlyReady.map((quest) => quest.id)]),
      ]);
    setTime({ server: new Date(next.serverTime).getTime(), client: Date.now() });
    setSnapshot(next);
    if (next.activeBattle) {
      setSection((current) =>
        next.activeExploration
          ? "explore"
          : current === "explore" || current === "battle"
            ? current
            : "battle",
      );
    } else {
      setBlockedDestination(null);
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const client = Date.now();
      setTime((previous) => ({ client, server: previous.server + client - previous.client }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    const generation = ++refreshGeneration.current;
    try {
      const response = await fetch("/api/game", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data: ApiResponse = await response.json();
      if (
        response.ok &&
        data.snapshot &&
        generation === refreshGeneration.current &&
        !busyRef.current
      )
        adopt(data.snapshot);
    } catch {
      /* O estado permanece visível; a próxima ação informa falhas de conexão. */
    }
  }, [adopt, router]);
  useEffect(() => {
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  async function act(payload: ActionPayload) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    refreshGeneration.current++;
    const previous = retryRef.current;
    const key =
      previous && JSON.stringify(previous.payload) === JSON.stringify(payload)
        ? previous.key
        : crypto.randomUUID();
    retryRef.current = { payload, key };
    try {
      const response = await fetch("/api/game/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey: key }),
      });
      const data: ApiResponse = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        if (response.status < 500) retryRef.current = null;
        setNotice({
          text: data.error?.message ?? "Não foi possível concluir a ação.",
          error: true,
        });
        return;
      }
      retryRef.current = null;
      if (data.snapshot) {
        // Replacing commands with a shorter result must not clamp the current viewport upward.
        if (snapshot.activeBattle && !data.snapshot.activeBattle)
          setRetainedPageHeight(window.scrollY + window.innerHeight);
        if (
          data.snapshot.latestBattle?.id !== snapshot.latestBattle?.id &&
          data.snapshot.latestBattle
        ) {
          setAnimatedBattleId(data.snapshot.latestBattle.id);
          setLootRevealId(data.snapshot.latestBattle.id);
          setPendingPresentationId(data.snapshot.latestBattle.id);
        }
        adopt(data.snapshot);
        const feedback = data.snapshot.activeExploration?.feedback;
        if (
          feedback &&
          feedback.id !== snapshot.activeExploration?.feedback?.id &&
          !data.snapshot.activeBattle &&
          !(
            data.snapshot.latestBattle &&
            data.snapshot.latestBattle.id !== snapshot.latestBattle?.id
          )
        ) {
          setLootRevealId(feedback.id);
          if (feedback.gained.items.length || feedback.kind === "loss")
            setPendingPresentationId(feedback.id);
        }
        if (
          data.snapshot.latestExploration?.id !== snapshot.latestExploration?.id &&
          data.snapshot.latestExploration &&
          !data.snapshot.activeExploration
        ) {
          setLootRevealId(data.snapshot.latestExploration.id);
          setPendingPresentationId(data.snapshot.latestExploration.id);
        }
        if (
          section !== "explore" &&
          section !== "battle" &&
          ((data.snapshot.activeBattle?.id !== snapshot.activeBattle?.id &&
            data.snapshot.activeBattle) ||
            (data.snapshot.latestBattle?.id !== snapshot.latestBattle?.id &&
              data.snapshot.latestBattle))
        )
          go("battle", { scrollToTop: false });
        if (
          payload.action === "battle" ||
          payload.action === "boss" ||
          payload.action === "explore" ||
          (payload.action === "exploration.fight" &&
            (data.snapshot.activeBattle ||
              data.snapshot.latestBattle?.id !== snapshot.latestBattle?.id))
        ) {
          setRetainedPageHeight(undefined);
          const battleArea =
            data.snapshot.activeBattle?.areaId ?? data.snapshot.latestBattle?.areaId;
          if (battleArea) setAreaId(battleArea);
          const destination = data.snapshot.activeBattle?.id ?? data.snapshot.latestBattle?.id;
          if (destination) setArenaArrivalId(destination);
        }
      }
      setNotice({ text: data.message ?? "Ação concluída.", error: false });
    } catch {
      setNotice({
        text: "Conexão interrompida. Repita a ação para consultar o resultado com segurança.",
        error: true,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const { character: c, stats, catalog, activity } = snapshot;
  const completedQuests = readyQuests(snapshot).filter((quest) =>
    pendingQuestIds.includes(quest.id),
  );
  const canShowCompletion =
    !snapshot.activeBattle &&
    !snapshot.activeExploration &&
    !blockedDestination &&
    (!pendingPresentationId || (section !== "battle" && section !== "explore"));
  const currentChapter =
    catalog.chapters.find((ch) => !c.flags.includes(`quest:${ch.finaleQuestId}`)) ??
    catalog.chapters.at(-1);
  const now = time.server;
  const remaining = activity
    ? Math.max(0, Math.ceil((new Date(activity.finishesAt).getTime() - now) / 1000))
    : 0;
  const battleWait = c.nextBattleAt
    ? Math.max(0, Math.ceil((new Date(c.nextBattleAt).getTime() - now) / 1000))
    : 0;
  const blocked =
    busy ||
    Boolean(activity) ||
    Boolean(snapshot.activeBattle) ||
    Boolean(snapshot.activeExploration);
  const combatBlocked = blocked || battleWait > 0 || c.hp <= 0;
  const currentSection = sections.find((s) => s.id === section)!;
  const boss = catalog.enemies.find((e) => e.id === "piccolo-daimao");
  function requirements(req: Requirements) {
    return unmetRequirements(req, {
      level: c.level,
      powerLevel: stats.powerLevel,
      raceId: c.raceId,
      flags: c.flags,
    });
  }
  function go(next: Section, { scrollToTop = true }: { scrollToTop?: boolean } = {}) {
    if (snapshot.activeBattle && next !== section) {
      setMobileOpen(false);
      setBlockedDestination(sections.find((candidate) => candidate.id === next)!.label);
      return;
    }
    setSection(next);
    if (next !== "quests") setFocusedQuestIds([]);
    setMobileOpen(false);
    if (scrollToTop) {
      setRetainedPageHeight(undefined);
      window.scrollTo(0, 0);
    }
  }
  const trainingRule = catalog.policies.find((p) => p.id === "training");
  const restRule = catalog.policies.find((p) => p.id === "rest");
  const ActionIcon = busy ? LoaderCircle : ArrowRight;

  return (
    <div className="game-layout" style={{ minHeight: retainedPageHeight }}>
      <div className="game-body">
        <a className="skip-to-game" href="#game-content">
          Ir para o jogo
        </a>
        <div className="game-announcement">
          <span>
            <DragonBall stars={1} /> TREINE. EVOLUA. SUPERE SEUS LIMITES.
          </span>
          <span>PRIMEIRA JORNADA · PROJETO DE FÃ</span>
        </div>
        <header className="game-header">
          <button
            className="header-brand-button"
            aria-label="Voltar ao início"
            onClick={() => go("character")}
          >
            <Brand light />
          </button>
          <div className="header-right">
            <span className="header-zeni">
              <span>◈</span> {n(c.zeni)} <small>ZENI</small>
            </span>
            <button
              className="icon-button mobile-menu"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
              aria-controls="game-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
          <nav
            id="game-navigation"
            className={`game-navigation ${mobileOpen ? "open" : ""}`}
            aria-label="Menu do jogo"
          >
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-label={label}
                aria-current={section === id ? "page" : undefined}
                className={`nav-item ${section === id ? "active" : ""}`}
                onClick={() => go(id)}
              >
                <Icon size={17} />
                <span>{label}</span>
                {id === "inventory" && snapshot.inventory.length > 0 && (
                  <small>{snapshot.inventory.length}</small>
                )}
                {id === "transformations" && <span className="nav-coming-soon">EM BREVE</span>}
              </button>
            ))}
            <Link
              href="/perfil"
              prefetch={false}
              className="nav-item nav-profile"
              onClick={(event) => {
                if (!snapshot.activeBattle) return;
                event.preventDefault();
                setMobileOpen(false);
                setBlockedDestination("Perfil");
              }}
              onNavigate={(event) => {
                event.preventDefault();
                if (snapshot.activeBattle) return;
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Perfil precisa de uma nova leitura da sessão e do personagem.
                window.location.assign("/perfil");
              }}
            >
              <Settings size={17} />
              <span>Perfil</span>
            </Link>
            <button
              className="nav-item nav-signout"
              aria-label="Sair da conta"
              onClick={async () => {
                if (snapshot.activeBattle) {
                  setMobileOpen(false);
                  setBlockedDestination("Sair da conta");
                  return;
                }
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={17} />
              <span>Sair</span>
            </button>
          </nav>
        </header>
        <div className="resource-strip">
          <div className="strip-character">
            <span className="mini-avatar">
              <UserRound size={20} />
            </span>
            <strong>
              {c.name}
              <small>
                {snapshot.race.name} · Nível {c.level}
              </small>
            </strong>
          </div>
          <span className="strip-power">
            <Zap size={15} /> <strong>{n(stats.powerLevel)}</strong>
            <small>POWER LEVEL</small>
          </span>
          <Meter compact label="HP" value={c.hp} max={stats.maxHp} />
          <Meter compact label="Ki" value={c.ki} max={stats.maxKi} variant="ki" />
          <span className="strip-xp">
            {n(c.xp)} / {n(snapshot.xpRequired)} XP
          </span>
        </div>
        <main id="game-content" className="game-main">
          {section !== "character" && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">SUPERE SEUS LIMITES</span>
                <h1>{currentSection.label}</h1>
                <p>
                  {section === "training"
                    ? "O poder vem da dedicação. Concentre-se e evolua."
                    : section === "explore"
                      ? "Há um mundo inteiro esperando pelo seu próximo passo."
                      : section === "battle"
                        ? "Escolha seu adversário. Coloque seu poder à prova."
                        : section === "inventory"
                          ? "Prepare seu equipamento e cuide dos seus recursos."
                          : section === "techniques"
                            ? "Domine seu Ki. Defina como você luta."
                            : section === "transformations"
                              ? "Novos poderes exigem mais do que um nível."
                              : section === "ranking"
                                ? "Veja sua posição entre os guerreiros da Terra."
                                : section === "settlements"
                                  ? "Abasteça sua bolsa, fabrique equipamentos e troque seus troféus."
                                  : "Conclua os objetivos e abra o próximo capítulo da sua história."}
                </p>
              </div>
              <span className="chapter-tag">
                <DragonBall stars={1} />
                <span>
                  CAPÍTULO {String(currentChapter?.order ?? 1).padStart(2, "0")}
                  <small>{currentChapter?.name.toUpperCase() ?? "O INÍCIO DA JORNADA"}</small>
                </span>
              </span>
            </div>
          )}
          <CombatModeSelector snapshot={snapshot} busy={busy} onAction={act} />
          {notice && (
            <div
              className={`notice ${notice.error ? "error" : "success"}`}
              role={notice.error ? "alert" : "status"}
            >
              {notice.error ? <CircleHelp size={18} /> : <Check size={18} />}
              <span>{notice.text}</span>
              <button aria-label="Fechar aviso" onClick={() => setNotice(null)}>
                <X size={16} />
              </button>
            </div>
          )}
          {snapshot.activeExploration && section !== "explore" && !snapshot.activeBattle && (
            <aside
              className="activity-banner expedition-lock-banner"
              aria-labelledby="expedition-lock-title"
              role="status"
            >
              <span className="expedition-lock-emblem" aria-hidden="true">
                <Compass size={28} />
                <LockKeyhole size={13} />
              </span>
              <div>
                <span className="eyebrow orange">EXPEDIÇÃO EM ANDAMENTO</span>
                <strong id="expedition-lock-title">Novas batalhas bloqueadas</strong>
                <p id="expedition-lock-message">
                  {snapshot.activeExploration.status === "ambush"
                    ? "Há uma emboscada esperando você. Resolva-a em Explorar e encerre a expedição para liberar novas batalhas."
                    : "Sua expedição ainda não terminou. Encerre-a em Explorar para liberar novas batalhas e trocar de área."}
                </p>
              </div>
              <button className="button primary" onClick={() => go("explore")}>
                Voltar à exploração <ArrowRight size={17} />
              </button>
            </aside>
          )}
          {section === "explore" && (
            <ExplorationPanel
              snapshot={snapshot}
              areaId={areaId}
              onArea={setAreaId}
              busy={busy}
              now={now}
              onAction={act}
              revealId={lootRevealId}
              onPresentationComplete={presentationComplete}
              combatPresentation={Boolean(
                snapshot.activeBattle ||
                (snapshot.activeExploration?.status === "checkpoint" &&
                  snapshot.activeExploration.battleId &&
                  snapshot.activeExploration.battleId === snapshot.latestBattle?.id &&
                  dismissedBattleId !== snapshot.latestBattle?.id),
              )}
            />
          )}
          {section === "battle" && (
            <BattleDestinations
              snapshot={snapshot}
              areaId={areaId}
              onArea={setAreaId}
              busy={blocked}
              wait={battleWait}
              onAction={act}
              onVillage={() => go("settlements")}
            />
          )}
          {(snapshot.activeBattle ||
            (dismissedBattleId !== snapshot.latestBattle?.id &&
              (section === "battle" ||
                (section === "explore" &&
                  snapshot.activeExploration?.battleId === snapshot.latestBattle?.id)) &&
              snapshot.latestBattle)) && (
            <div
              ref={arenaAnchor}
              className="battle-arena-anchor"
              tabIndex={-1}
              aria-label="Arena de combate"
            >
              <BattleArena
                key={snapshot.activeBattle?.id ?? snapshot.latestBattle!.id}
                snapshot={
                  section === "explore" ? explorationBattlePresentation(snapshot) : snapshot
                }
                busy={busy}
                onAction={act}
                autoplay={
                  animatedBattleId === (snapshot.activeBattle?.id ?? snapshot.latestBattle?.id)
                }
                onAutoplayConsumed={consumedAnimation}
                revealLoot={lootRevealId === snapshot.latestBattle?.id}
                onPresentationComplete={presentationComplete}
                onContinue={() => {
                  setDismissedBattleId(snapshot.latestBattle!.id);
                  presentationComplete(snapshot.latestBattle!.id);
                  setRetainedPageHeight(undefined);
                  requestAnimationFrame(() => {
                    const target = document.querySelector<HTMLElement>(
                      section === "explore" ? ".expedition-checkpoint" : ".battle-destinations",
                    );
                    if (target) {
                      target.tabIndex = -1;
                      target.focus({ preventScroll: true });
                      target.scrollIntoView({
                        block: "start",
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                          ? "instant"
                          : "smooth",
                      });
                    }
                  });
                }}
              />
            </div>
          )}
          {activity && (
            <div className="activity-banner">
              <span className="activity-icon">
                {activity.kind === "training" ? <Dumbbell size={22} /> : <Heart size={22} />}
              </span>
              <div>
                <strong>
                  {activity.kind === "training"
                    ? "Treinamento em andamento"
                    : "Recuperando suas forças"}
                </strong>
                <p>
                  {remaining
                    ? `Faltam ${remaining}s. Você pode explorar as telas enquanto aguarda.`
                    : "Atividade pronta! Conclua para receber o resultado."}
                </p>
              </div>
              <button
                className="button small primary"
                disabled={busy || remaining > 0}
                onClick={() => act({ action: "activity.finish", activityId: activity.id })}
              >
                {remaining ? (
                  <>
                    <Clock3 size={15} /> {remaining}s
                  </>
                ) : (
                  <>
                    <Check size={16} /> Concluir atividade
                  </>
                )}
              </button>
            </div>
          )}
          {c.hp <= 0 && !activity && (
            <div className="notice error">
              <Heart size={18} />
              <span>
                Você foi derrotado. Descanse gratuitamente ou use um item para recuperar HP.
              </span>
              <button
                className="button small"
                disabled={busy}
                onClick={() => act({ action: "rest.start" })}
              >
                Descansar
              </button>
            </div>
          )}

          {section === "character" && (
            <>
              <GameLobby
                snapshot={snapshot}
                busy={busy}
                onNavigate={go}
                onAreaSelect={(mode, selectedAreaId) => {
                  setAreaId(selectedAreaId);
                  go(mode);
                }}
                onCharacter={() =>
                  document.getElementById("character-sheet")?.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                      ? "instant"
                      : "smooth",
                    block: "start",
                  })
                }
                onTrain={() => act({ action: "training.start" })}
                onRest={() => act({ action: "rest.start" })}
              />
              <div className="lobby-character-heading" id="character-sheet">
                <h2>Olá, {c.name}.</h2>
                <span>SEU GUERREIRO · {snapshot.race.name.toUpperCase()}</span>
              </div>
              <div className="dashboard-top">
                <section className="warrior-card">
                  <div className="warrior-background">
                    <span className="aura-ring ring1" />
                    <span className="aura-ring ring2" />
                    <span className="warrior-kanji">悟</span>
                  </div>
                  <div className="warrior-top">
                    <span className="eyebrow">FICHA DO GUERREIRO</span>
                    <span className="level-pill">NÍVEL {c.level}</span>
                  </div>
                  <div className="warrior-identity">
                    <div className="warrior-avatar">
                      <RaceEmblem raceId={c.raceId} />
                    </div>
                    <div>
                      <span className="race-pill">{snapshot.race.name}</span>
                      <h2>{c.name}</h2>
                      <span className="warrior-rank">Guerreiro da Terra</span>
                    </div>
                  </div>
                  <div className="warrior-power">
                    <Zap size={19} />
                    <div>
                      <small>POWER LEVEL</small>
                      <strong>{n(stats.powerLevel)}</strong>
                    </div>
                    <span className="power-label">POTENCIAL EM EVOLUÇÃO</span>
                  </div>
                  <div className="warrior-progress">
                    <Meter
                      label={`Nível ${c.level}`}
                      value={c.xp}
                      max={snapshot.xpRequired}
                      variant="xp"
                    />
                    <span>
                      Faltam <strong>{n(snapshot.xpRequired - c.xp)} XP</strong> para o nível{" "}
                      {c.level + 1}
                    </span>
                  </div>
                </section>
                <div className="status-column">
                  <section className="panel vital-panel">
                    <div className="section-title">
                      <h3>Pronto para a próxima batalha?</h3>
                      <span className="badge">RECURSOS</span>
                    </div>
                    <Meter label="Vida / HP" value={c.hp} max={stats.maxHp} />
                    <Meter label="Energia / Ki" value={c.ki} max={stats.maxKi} variant="ki" />
                    <div className="vital-bottom">
                      <span>
                        <Clock3 size={13} /> Descanso: {restRule?.durationSeconds}s
                      </span>
                      <button
                        className="text-button"
                        disabled={blocked || (c.hp === stats.maxHp && c.ki === stats.maxKi)}
                        onClick={() => act({ action: "rest.start" })}
                      >
                        Recuperar recursos
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </section>
                </div>
              </div>
              <div className="dashboard-middle">
                <BuildPanel
                  key={JSON.stringify(c.allocation)}
                  snapshot={snapshot}
                  busy={blocked}
                  onAction={act}
                  onVillage={() => go("settlements")}
                />
                <FighterAttributes
                  race={snapshot.race}
                  attributes={stats}
                  base={c.base}
                  stats={stats}
                />
                <section className="panel equipment-panel">
                  <div className="section-title">
                    <h3>
                      <Shield size={18} /> Equipamentos
                    </h3>
                    <button className="text-button" onClick={() => go("inventory")}>
                      Gerenciar
                      <ChevronRight size={13} />
                    </button>
                  </div>
                  <div className="equipment-slots">
                    {(["weapon", "armor", "boots", "accessory"] as const).map((slot) => {
                      const item = catalog.items.find((i) => i.id === c.equipment[slot]);
                      return (
                        <div key={slot} className="equipment-slot">
                          <ItemIcon item={item} />
                          <span>
                            <small>
                              {slot === "weapon"
                                ? "ARMA"
                                : slot === "armor"
                                  ? "ARMADURA"
                                  : slot === "boots"
                                    ? "BOTAS"
                                    : "ACESSÓRIO"}
                            </small>
                            <strong>{item?.name ?? "Slot vazio"}</strong>
                            {item && <ItemEffects item={item} />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
              <div className="dashboard-bottom">
                <section className="panel history-panel">
                  <div className="section-title">
                    <h3>
                      <Clock3 size={17} /> Últimas atividades
                    </h3>
                    <span className="status-dot" />
                  </div>
                  <div className="history-list">
                    {snapshot.history.map((h) => (
                      <div key={h.id}>
                        <span className={`history-icon ${h.kind}`}>
                          {h.kind === "battle" ? (
                            <Swords size={15} />
                          ) : h.kind === "training" ? (
                            <Dumbbell size={15} />
                          ) : h.kind === "technique" ? (
                            <Zap size={15} />
                          ) : (
                            <Check size={15} />
                          )}
                        </span>
                        <span>
                          {h.description}
                          <small>
                            {new Date(h.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Sao_Paulo",
                            })}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                {boss && (
                  <section className="boss-teaser">
                    <EnemyPortrait enemyId={boss.id} className="boss-teaser-art" sizes="200px" />
                    <span className="eyebrow">UM DESAFIO À ALTURA</span>
                    <h2>
                      O Rei Demônio
                      <br />
                      está esperando.
                    </h2>
                    <p>
                      Piccolo Daimao ameaça a Terra.
                      <br />
                      Treine. Prepare-se. Enfrente seu destino.
                    </p>
                    <button
                      className="button boss-button"
                      onClick={() => {
                        const area = catalog.encounters.find((e) => e.enemyId === boss.id)?.areaId;
                        if (area) setAreaId(area);
                        go("battle");
                      }}
                    >
                      Ver desafio
                      <ArrowRight size={17} />
                    </button>
                    <small>
                      <LockKeyhole size={12} /> Campanha clássica · nível 19+ e vitória contra Drum
                    </small>
                  </section>
                )}
              </div>
            </>
          )}

          {section === "training" && (
            <div className="training-grid">
              <section className="panel training-card">
                <div
                  className={`activity-art training-art${activity?.kind === "training" && remaining > 0 ? " activity-art-active" : ""}`}
                >
                  {activity?.kind === "training" && remaining > 0 ? (
                    <ActivityAnimation
                      kind="training"
                      remaining={remaining}
                      duration={trainingRule?.durationSeconds ?? remaining}
                      fallbackArt={destinationArtwork.training}
                    />
                  ) : (
                    <ArtworkImage
                      art={destinationArtwork.training}
                      sizes="(max-width: 900px) 90vw, 55vw"
                      fallback={<Dumbbell size={52} />}
                    />
                  )}
                </div>
                <span className="eyebrow orange">DISCIPLINA. FOCO. EVOLUÇÃO.</span>
                <h2>Treinamento de combate</h2>
                <p>
                  Fortaleça seu corpo e aprenda a concentrar seu Ki.
                  <br />
                  Cada sessão aproxima você do próximo nível.
                </p>
                <div className="training-rewards">
                  <span>
                    <Zap size={20} />
                    <strong>+{trainingRule?.xpReward}</strong>
                    <small>EXPERIÊNCIA</small>
                  </span>
                  <span>
                    <Clock3 size={20} />
                    <strong>{trainingRule?.durationSeconds}s</strong>
                    <small>DURAÇÃO</small>
                  </span>
                </div>
                <button
                  className="button primary"
                  disabled={blocked}
                  onClick={() => act({ action: "training.start" })}
                >
                  {busy ? <LoaderCircle className="spin" size={18} /> : <Dumbbell size={18} />}{" "}
                  Iniciar treinamento
                </button>
                <small>Uma sessão por vez. Seu treino continua ao fechar o jogo.</small>
              </section>
              <div>
                <section className="panel recovery-card">
                  <div
                    className={`activity-art recovery-art${activity?.kind === "rest" && remaining > 0 ? " activity-art-active" : ""}`}
                  >
                    {activity?.kind === "rest" && remaining > 0 ? (
                      <ActivityAnimation
                        kind="rest"
                        remaining={remaining}
                        duration={restRule?.durationSeconds ?? remaining}
                        fallbackArt={destinationArtwork.rest}
                      />
                    ) : (
                      <ArtworkImage
                        art={destinationArtwork.rest}
                        sizes="(max-width: 900px) 90vw, 40vw"
                        fallback={<Heart size={30} />}
                      />
                    )}
                  </div>
                  <h3>Recupere suas forças</h3>
                  <p>
                    Descansar restaura completamente seu HP e Ki. Prepare-se para voltar à batalha.
                  </p>
                  <div className="recovery-meters">
                    <Meter label="HP" value={c.hp} max={stats.maxHp} />
                    <Meter label="Ki" value={c.ki} max={stats.maxKi} variant="ki" />
                  </div>
                  <button
                    className="button secondary"
                    disabled={blocked}
                    onClick={() => act({ action: "rest.start" })}
                  >
                    <Clock3 size={16} /> Descansar por {restRule?.durationSeconds}s
                  </button>
                  <span className="free-tag">GRATUITO • SEM CUSTO DE ZENI</span>
                </section>
                <section className="training-tip">
                  <Sparkles size={22} />
                  <div>
                    <strong>Cada raça tem seu potencial.</strong>
                    <p>
                      {snapshot.race.trait}. Distribua os pontos de cada nível para construir sua
                      especialização.
                    </p>
                  </div>
                </section>
              </div>
            </div>
          )}

          {section === "battle" && (
            <HeroicPanel snapshot={snapshot} busy={combatBlocked} onAction={act} />
          )}

          {section === "inventory" && (
            <>
              <PreparationPanel snapshot={snapshot} busy={blocked} onAction={act} />
              <div className="inventory-toolbar">
                <span>
                  <Package size={18} /> {snapshot.inventory.reduce((sum, i) => sum + i.quantity, 0)}{" "}
                  itens na mochila
                </span>
                <small>Equipamentos adicionam atributos ao seu personagem.</small>
              </div>
              {snapshot.inventory.length === 0 ? (
                <section className="panel empty-state">
                  <Package size={45} strokeWidth={1.2} />
                  <h2>Sua mochila está pronta para a aventura.</h2>
                  <p>Vença inimigos para conseguir poções e equipamentos.</p>
                  <button className="button primary" onClick={() => go("explore")}>
                    Explorar a Terra
                    <ArrowRight size={16} />
                  </button>
                </section>
              ) : (
                <div className="inventory-grid">
                  {sortItemsByRarity(snapshot.inventory, catalog.items).map((owned) => {
                    const item = catalog.items.find((i) => i.id === owned.itemId)!;
                    const equipped = Object.values(c.equipment).includes(item.id);
                    const reasons = requirements(item.requirements);
                    return (
                      <section className="panel inventory-card" key={item.id}>
                        <ItemIcon item={item} showcase />
                        <div className="item-top">
                          <span className={`rarity-label rarity-${item.rarity}`}>
                            {item.rarity === "rare"
                              ? "RARO"
                              : item.rarity === "common"
                                ? "COMUM"
                                : item.rarity.toUpperCase()}
                          </span>
                          <span className="item-quantity">×{owned.quantity}</span>
                        </div>
                        <h3>{item.name}</h3>
                        <details className="rpg-more-info">
                          <summary>Detalhes</summary>
                          <p>{item.description}</p>
                        </details>
                        <ItemEffects item={item} />
                        {!equipped && <EquipmentComparison snapshot={snapshot} item={item} />}
                        <div className="item-card-bottom">
                          {equipped ? (
                            <button
                              className="button small secondary"
                              disabled={blocked}
                              onClick={() => act({ action: "equipment.unequip", slot: item.slot! })}
                            >
                              <Check size={14} /> Equipado · remover
                            </button>
                          ) : item.type === "material" ? (
                            <button
                              className="button small secondary"
                              onClick={() => go("settlements")}
                            >
                              Usar nas vilas
                            </button>
                          ) : (
                            <button
                              className={`button small ${item.type === "equipment" ? "primary" : "secondary"}`}
                              disabled={
                                (item.type === "consumable"
                                  ? busy || Boolean(activity) || Boolean(snapshot.activeBattle)
                                  : blocked) || reasons.length > 0
                              }
                              onClick={() => {
                                if (
                                  item.effects.kiDamageBuff ||
                                  (item.effects.cure?.length &&
                                    !item.effects.restoreHp &&
                                    !item.effects.restoreKi)
                                ) {
                                  document
                                    .querySelector(".rpg-preparation")
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  return;
                                }
                                act(
                                  item.type === "equipment"
                                    ? { action: "equipment.equip", itemId: item.id }
                                    : { action: "item.use", itemId: item.id },
                                );
                              }}
                            >
                              {reasons.length ? (
                                <LockKeyhole size={14} />
                              ) : item.type === "equipment" ? (
                                <Shield size={14} />
                              ) : (
                                <Heart size={14} />
                              )}{" "}
                              {reasons.length
                                ? reasons[0]
                                : item.type === "equipment"
                                  ? "Equipar"
                                  : item.effects.kiDamageBuff ||
                                      (item.effects.cure?.length &&
                                        !item.effects.restoreHp &&
                                        !item.effects.restoreKi)
                                    ? "Preparar para batalha"
                                    : "Usar item"}
                            </button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {section === "techniques" && (
            <>
              <div className="technique-market-heading">
                <Store size={28} />
                <div>
                  <h2>Mercado de técnicas</h2>
                  <p>
                    Invista seus Zeni em novos golpes. Cada técnica tem seus próprios requisitos.
                  </p>
                </div>
              </div>
              <section className="panel technique-priority">
                <div>
                  <span className="eyebrow orange">SUA ESTRATÉGIA</span>
                  <h3>Prioridade de combate</h3>
                  <p>
                    No automático, esta é a ordem dos golpes. No manual, escolha entre estas
                    técnicas e Soco.
                  </p>
                </div>
                <div className="priority-chips">
                  {c.selectedTechniques.map((id, index) => (
                    <span key={id}>
                      <b>{index + 1}</b>
                      {catalog.techniques.find((t) => t.id === id)?.name}
                    </span>
                  ))}
                </div>
              </section>
              <div className="technique-grid">
                {catalog.techniques.map((technique) => {
                  const learned = snapshot.learnedTechniques.includes(technique.id);
                  const reasons = requirements(technique.requirements);
                  const master = catalog.masters.find(
                    (m) => m.id === technique.requirements.masterId,
                  );
                  const selected = c.selectedTechniques.includes(technique.id);
                  const art = techniqueArtwork[technique.id];
                  return (
                    <section
                      className={`panel technique-card ${learned ? "learned" : ""}`}
                      key={technique.id}
                    >
                      {art && (
                        <div className="technique-art">
                          <ArtworkImage
                            art={art}
                            sizes="(max-width: 700px) 90vw, 35vw"
                            fallback={<Zap size={40} />}
                          />
                        </div>
                      )}
                      <div className="technique-top">
                        <span className={`technique-icon ${technique.kind}`}>
                          <Zap size={27} />
                        </span>
                        <span className={`badge ${learned ? "green" : ""}`}>
                          {learned ? "APRENDIDA" : master ? "MESTRE FUTURO" : "DESBLOQUEÁVEL"}
                        </span>
                      </div>
                      <h3>{technique.name}</h3>
                      <details className="rpg-more-info">
                        <summary>Detalhes do golpe</summary>
                        <p>{technique.description}</p>
                      </details>
                      <div className="technique-stats">
                        <span>
                          <Zap size={13} /> {technique.kiCost} Ki
                        </span>
                        <span>
                          <Swords size={13} /> ×{technique.multiplier}
                        </span>
                        <span>
                          <Clock3 size={13} /> {technique.cooldown} turno(s)
                        </span>
                      </div>
                      {!learned && (
                        <div className="technique-requirements">
                          <span>Nível {technique.requirements.minLevel ?? 1}</span>
                          {master && (
                            <span>
                              <LockKeyhole size={12} /> {master.name}
                            </span>
                          )}
                          {technique.requirements.raceIds && (
                            <span>
                              {technique.requirements.raceIds
                                .map((id) => catalog.races.find((r) => r.id === id)?.name)
                                .join(" / ")}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="technique-bottom">
                        {learned ? (
                          <button
                            className="button secondary small"
                            disabled={blocked}
                            onClick={() =>
                              act({
                                action: "technique.select",
                                techniqueIds: [
                                  technique.id,
                                  ...c.selectedTechniques.filter((id) => id !== technique.id),
                                ].slice(0, 3),
                              })
                            }
                          >
                            <ArrowUp size={15} />
                            {selected && c.selectedTechniques[0] === technique.id
                              ? "Primeira prioridade"
                              : "Usar como prioridade"}
                          </button>
                        ) : (
                          <button
                            className="button primary small"
                            disabled={blocked || reasons.length > 0 || c.zeni < technique.learnCost}
                            onClick={() =>
                              act({ action: "technique.learn", techniqueId: technique.id })
                            }
                          >
                            {master ? <LockKeyhole size={14} /> : <Zap size={14} />}{" "}
                            {master
                              ? "Em uma próxima jornada"
                              : `Aprender · ${technique.learnCost} Zeni`}
                          </button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {section === "transformations" && (
            <>
              <section className="transformation-intro">
                <Flame size={40} />
                <div>
                  <span className="eyebrow">ALÉM DOS SEUS LIMITES</span>
                  <h2>O poder precisa ser despertado.</h2>
                  <p>
                    Transformações exigirão raça, poder e conquistas específicas. O sistema está
                    preparado; os desbloqueios chegarão nas próximas etapas.
                  </p>
                </div>
                <span className="badge">EM PREPARAÇÃO</span>
              </section>
              <div className="transformation-grid">
                {catalog.transformations
                  .filter(
                    (t) => !t.requirements.raceIds || t.requirements.raceIds.includes(c.raceId),
                  )
                  .map((form) => {
                    const art = transformationArtwork[form.id];
                    return (
                      <section
                        className={`panel transformation-card form-${form.id}`}
                        key={form.id}
                      >
                        <span className="transformation-portrait">
                          {art ? (
                            <ArtworkImage
                              art={art}
                              sizes="(max-width: 700px) 90vw, (max-width: 1000px) 45vw, 400px"
                              fallback={<Flame size={42} />}
                            />
                          ) : (
                            <Flame size={42} />
                          )}
                        </span>
                        <span className="badge">
                          <LockKeyhole size={12} /> BLOQUEADA
                        </span>
                        <h3>{form.name}</h3>
                        <p>{form.description}</p>
                        <div>
                          <span>Nível {form.requirements.minLevel}+</span>
                          <span>Power Level {n(form.requirements.minPower ?? 0)}+</span>
                          <span>Conquista específica de desbloqueio</span>
                        </div>
                      </section>
                    );
                  })}
              </div>
              {!catalog.transformations.some((t) => t.requirements.raceIds?.includes(c.raceId)) && (
                <section className="panel empty-state">
                  <Sparkles size={40} />
                  <h3>Seu próximo despertar ainda será revelado.</h3>
                  <p>
                    As evoluções de {snapshot.race.name} serão adicionadas em uma próxima etapa.
                  </p>
                </section>
              )}
            </>
          )}

          {section === "quests" && (
            <AdventurePanel
              snapshot={snapshot}
              focusedQuestIds={focusedQuestIds}
              busy={blocked || battleWait > 0}
              onAction={act}
              onArea={(id) => {
                setAreaId(id);
                go("battle");
              }}
            />
          )}
          {section === "settlements" && (
            <SettlementPanel
              key={c.respecCount}
              snapshot={snapshot}
              busy={blocked}
              onAction={act}
            />
          )}
          {section === "ranking" && <RankingPanel snapshot={snapshot} />}
          <footer className="game-footer">
            <span>
              DRAGON RUSH Z <small>• PROJETO DE FÃ</small>
            </span>
            <span>
              Treine. Evolua. Supere seus limites.
              <DragonBall stars={1} />
            </span>
          </footer>
        </main>
      </div>
      {busy && (
        <div className="action-indicator" role="status">
          <ActionIcon className="spin" size={16} /> Processando ação…
        </div>
      )}
      {blockedDestination && (
        <BattleNavigationNotice
          destination={blockedDestination}
          onClose={() => {
            setBlockedDestination(null);
            requestAnimationFrame(() => arenaAnchor.current?.focus({ preventScroll: true }));
          }}
        />
      )}
      {canShowCompletion && !busy && completedQuests.length > 0 && (
        <QuestCompletionNotice
          quests={completedQuests}
          items={catalog.items}
          onClose={() => setPendingQuestIds([])}
          onRewards={() => {
            setFocusedQuestIds(completedQuests.map((quest) => quest.id));
            setPendingQuestIds([]);
            go("quests");
          }}
        />
      )}
      {canShowCompletion &&
        completedQuests.length === 0 &&
        activity &&
        remaining === 0 &&
        section !== "training" &&
        dismissedActivityId !== activity.id && (
          <ActivityCompletionNotice
            kind={activity.kind}
            busy={busy}
            error={notice?.error ? notice.text : undefined}
            onClose={() => setDismissedActivityId(activity.id)}
            onConclude={() => act({ action: "activity.finish", activityId: activity.id })}
          />
        )}
    </div>
  );
}
