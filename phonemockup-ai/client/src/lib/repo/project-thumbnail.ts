/** The live scene retains its drawing buffer. A thumbnail must never block saving. */
export function captureProjectThumbnail(): string | undefined {
  try {
    if (document.querySelector('.studio-stage [data-slot="skeleton"]')) return;
    const source = document.querySelector<HTMLCanvasElement>(
      ".studio-stage canvas",
    );
    if (!source?.width || !source.height) return;
    const scale = Math.min(1, 512 / source.width, 384 / source.height);
    const thumbnail = document.createElement("canvas");
    thumbnail.width = Math.max(1, Math.round(source.width * scale));
    thumbnail.height = Math.max(1, Math.round(source.height * scale));
    const context = thumbnail.getContext("2d");
    if (!context) return;
    context.drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
    const image = thumbnail.toDataURL("image/webp", 0.72);
    return image.length < 90_000 ? image : undefined;
  } catch {
    return;
  }
}
