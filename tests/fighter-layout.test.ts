import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { enemyBattleSprites, playerBattleSprites } from "@/lib/game-art";
import { fighterFormation, fighterLayout } from "@/lib/fighter-layout";

const sprites = Object.entries({ ...playerBattleSprites, ...enemyBattleSprites });

describe("proportions and grounding of every battle fighter", () => {
  it("keeps small fighters smaller than Goku and giants taller than adult fighters", () => {
    const goku = playerBattleSprites.saiyajin!.scale;
    const krillin = playerBattleSprites.humano!.scale;
    expect(krillin).toBeLessThan(goku);
    for (const id of ["chaos", "pilaf", "prova-karin", "lobo", "saibaman"])
      expect(enemyBattleSprites[id]!.scale).toBeLessThan(krillin);
    expect(playerBattleSprites.namekuseijin!.scale).toBeGreaterThan(goku);
    expect(playerBattleSprites.majin!.scale).toBeGreaterThan(1.1 * goku);
    expect(enemyBattleSprites.tenshinhan!.scale).toBeGreaterThan(goku);
    for (const id of ["dinossauro", "major-metallic", "robo-pirata", "buyon", "giran", "drum"])
      expect(enemyBattleSprites[id]!.scale).toBeGreaterThan(1.4 * goku);
  });

  it.each(sprites)(
    "%s preserves aspect ratio, complete poses and a shared foot baseline",
    async (_, sprite) => {
      expect(sprite).toBeDefined();
      const { data, info } = await sharp(`public${sprite!.src}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const frames = sprite!.frames ?? 3;
      const frameWidth = sprite!.frameWidth ?? 160;
      const frameHeight = sprite!.frameHeight ?? 200;
      expect(info.width).toBe(frameWidth * frames);
      expect(info.height).toBe(frameHeight);
      expect(sprite!.bounds).toHaveLength(frames);
      const idle = sprite!.bounds![0];
      const expectedHeight = sprite!.scale * (128 / 200);
      for (let pose = 0; pose < frames; pose++) {
        const layout = fighterLayout(sprite, pose);
        const bounds = sprite!.bounds![pose];
        const pixelScale = layout.sheetHeight / frameHeight;
        expect(layout.sheetWidth / (frameWidth * frames)).toBeCloseTo(pixelScale, 10);
        expect((idle.bottom - idle.top + 1) * pixelScale).toBeCloseTo(expectedHeight, 10);
        const top = layout.height - layout.sheetHeight - layout.sheetBottom;
        expect(top + bounds.top * pixelScale).toBeGreaterThanOrEqual(-0.000001);
        expect(top + (bounds.bottom + 1) * pixelScale).toBeCloseTo(layout.height, 10);
        let clippedPixels = 0;
        for (let y = 0; y < frameHeight; y++)
          for (let x = 0; x < frameWidth; x++) {
            if (data[(y * info.width + pose * frameWidth + x) * 4 + 3] <= 8) continue;
            if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)
              clippedPixels++;
          }
        expect(clippedPixels, `visible pixels clipped in pose ${pose}`).toBe(0);
      }
    },
  );

  it("fits the complete formation together without independently shrinking giants", () => {
    const goku = playerBattleSprites.saiyajin!;
    const dinosaur = enemyBattleSprites.dinossauro!;
    const formation = fighterFormation([goku, dinosaur]);
    expect(formation.width).toBeGreaterThanOrEqual(fighterLayout(dinosaur).width);
    expect(formation.height).toBeGreaterThanOrEqual(fighterLayout(dinosaur).height);
    expect(enemyBattleSprites["fera-planicies"]).toBe(dinosaur);
  });
});
