import type { SpriteSheet } from "./game-art";

// Goku's standing artwork occupies 128 pixels of its 200-pixel frame.
// A sprite's scale describes its visible height relative to Goku, not its canvas.
const referenceHeight = 128 / 200;

export function fighterLayout(sprite?: SpriteSheet, pose = 0) {
  const frameWidth = sprite?.frameWidth ?? 160;
  const frameHeight = sprite?.frameHeight ?? 200;
  const frames = sprite?.frames ?? 3;
  const bounds = sprite?.bounds ?? [
    { left: 0, right: frameWidth - 1, top: 0, bottom: frameHeight - 1 },
  ];
  const idleHeight = bounds[0].bottom - bounds[0].top + 1;
  const pixelsPerUnit = ((sprite?.scale ?? 1) * referenceHeight) / idleHeight;
  const left = Math.min(...bounds.map((frame) => frame.left));
  const right = Math.max(...bounds.map((frame) => frame.right));
  const height = Math.max(...bounds.map((frame) => frame.bottom - frame.top + 1));
  const index = Math.max(0, Math.min(frames - 1, Math.trunc(pose)));
  const current = bounds[index] ?? bounds[0];
  return {
    width: (right - left + 1) * pixelsPerUnit,
    height: height * pixelsPerUnit,
    sheetWidth: frameWidth * frames * pixelsPerUnit,
    sheetHeight: frameHeight * pixelsPerUnit,
    sheetLeft: -left * pixelsPerUnit,
    sheetBottom: -(frameHeight - current.bottom - 1) * pixelsPerUnit,
    translateX: (-100 * index) / frames,
  };
}

// The same camera scale applies to both sides, including the widest attack pose.
export function fighterFormation(sprites: readonly (SpriteSheet | undefined)[]) {
  const layouts = sprites.map((sprite) => fighterLayout(sprite));
  return {
    width: Math.max(1, ...layouts.map((layout) => layout.width)),
    height: Math.max(1, ...layouts.map((layout) => layout.height)),
  };
}
