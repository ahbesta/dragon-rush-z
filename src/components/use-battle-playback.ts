"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleFrame, BattlePresentation } from "@/lib/battle-presentation";

export function useBattlePlayback(model: BattlePresentation, autoplay: boolean) {
  const [visual, setVisual] = useState(() => ({
    frame: null as BattleFrame | null,
    vitals: autoplay ? model.initial : model.final,
    playing: autoplay && model.frames.length > 0,
    reducedMotion: false,
    phase: autoplay ? undefined : model.frames.at(-1)?.phase,
    cycle: 0,
    duration: 850,
  }));
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const reduced = useRef(false);
  const initialized = useRef(false);
  const seen = useRef(-1);
  const queue = useRef<BattleFrame[]>([]);
  const running = useRef(false);
  const latest = useRef(model);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<number | null>(null);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    queue.current = [];
    running.current = false;
  }, []);
  const settle = useCallback(() => {
    const current = latest.current;
    setVisual((old) => ({
      ...old,
      frame: null,
      vitals: current.final,
      playing: false,
      phase: current.frames.at(-1)?.phase,
      reducedMotion: reduced.current,
    }));
  }, []);
  const next = useCallback(
    function playNext() {
      const frame = queue.current.shift();
      if (!frame || reduced.current) {
        running.current = false;
        settle();
        return;
      }
      running.current = true;
      const duration =
        (frame.kind === "phase" ? 1100 : frame.kind === "effect" ? 650 : 850) / speedRef.current;
      setVisual((old) => ({
        ...old,
        frame,
        vitals: frame.before,
        playing: true,
        phase: frame.phase,
        cycle: old.cycle + 1,
        duration,
      }));
      timers.current = [
        setTimeout(() => setVisual((old) => ({ ...old, vitals: frame.after })), duration * 0.48),
        setTimeout(playNext, duration),
      ];
    },
    [settle],
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      reduced.current = media.matches;
      if (media.matches) {
        clear();
        settle();
      } else setVisual((old) => ({ ...old, reducedMotion: false }));
    };
    reduced.current = media.matches;
    media.addEventListener("change", change);
    return () => {
      media.removeEventListener("change", change);
      clear();
      // O Strict Mode repete os efeitos de montagem no desenvolvimento.
      initialized.current = false;
      seen.current = -1;
    };
  }, [clear, settle]);
  useEffect(() => {
    latest.current = model;
    const unseen = model.frames.filter((frame) => frame.seq > seen.current);
    seen.current = model.frames.at(-1)?.seq ?? -1;
    const shouldPlay = initialized.current || autoplay;
    initialized.current = true;
    if (reduced.current || !shouldPlay) {
      clear();
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        settle();
      });
    } else if (unseen.length > 0) {
      queue.current.push(...unseen);
      if (!running.current && raf.current === null) {
        raf.current = requestAnimationFrame(() => {
          raf.current = null;
          next();
        });
      }
    }
  }, [model, autoplay, clear, next, settle]);
  const skip = useCallback(() => {
    clear();
    settle();
  }, [clear, settle]);
  const replay = useCallback(() => {
    clear();
    if (reduced.current) {
      settle();
      return;
    }
    queue.current = [...latest.current.frames];
    next();
  }, [clear, next, settle]);
  const toggleSpeed = useCallback(() => {
    speedRef.current = speedRef.current === 1 ? 2 : 1;
    setSpeed(speedRef.current);
  }, []);
  return { ...visual, speed, skip, replay, toggleSpeed };
}
