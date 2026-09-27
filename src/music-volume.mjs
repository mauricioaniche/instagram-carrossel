// Composition time keeps fades at the ends of the reel, even when audio loops.
export function backgroundVolume(frame, totalFrames, volume = 0.18, fps = 30) {
  const fadeIn = Math.min(fps, totalFrames / 3);
  const fadeOut = Math.max(1, Math.min(fps * 2, totalFrames - fadeIn - 1));
  return volume * Math.max(0, Math.min(1, frame / fadeIn, (totalFrames - 1 - frame) / fadeOut));
}
