import { expect, type Locator } from "@playwright/test";

/** Every pose must occupy the whole viewport without cropping or distortion. */
export async function expectFullActivityScene(scene: Locator, durationMs: number) {
  await expect(scene).toHaveAttribute("data-playing", "true");
  const geometry = await scene.evaluate((element, duration) => {
    const viewport = element.querySelector(".activity-animation-viewport")!;
    const image = element.querySelector("img")!;
    const caption = element.querySelector(".activity-animation-caption")!;
    const animation = image.getAnimations()[0];
    const previousTime = animation.currentTime;
    const wasRunning = animation.playState === "running";
    animation.pause();
    const bounds = viewport.getBoundingClientRect();
    const frames = Array.from({ length: 6 }, (_, index) => {
      animation.currentTime = ((index + 0.5) * duration) / 6;
      const rect = image.getBoundingClientRect();
      return {
        left: rect.left + (index * rect.width) / 6,
        top: rect.top,
        width: rect.width / 6,
        height: rect.height,
      };
    });
    animation.currentTime = previousTime;
    if (wasRunning) animation.play();
    return {
      frames,
      viewport: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      captionTop: caption.getBoundingClientRect().top,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      duration: getComputedStyle(image).animationDuration,
    };
  }, durationMs);
  expect(geometry.naturalWidth).toBe(4800);
  expect(geometry.naturalHeight).toBe(450);
  expect(geometry.duration).toBe(`${durationMs / 1000}s`);
  expect(geometry.viewport.width / geometry.viewport.height).toBeCloseTo(16 / 9, 2);
  expect(geometry.captionTop).toBeGreaterThanOrEqual(
    geometry.viewport.top + geometry.viewport.height - 0.1,
  );
  for (const frame of geometry.frames) {
    expect(frame.left).toBeCloseTo(geometry.viewport.left, 1);
    expect(frame.top).toBeCloseTo(geometry.viewport.top, 1);
    expect(frame.width).toBeCloseTo(geometry.viewport.width, 1);
    expect(frame.height).toBeCloseTo(geometry.viewport.height, 1);
  }
}
