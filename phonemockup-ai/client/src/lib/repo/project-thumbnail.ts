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
    let image = thumbnail.toDataURL("image/webp", 0.72);
    if (!image.startsWith("data:image/webp")) {
      // Safari can't encode WebP and quietly returns a PNG several times
      // larger, which went over the cap and left the card without a preview.
      // JPEG has no alpha, so a see-through scene sits on paper.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#f1f0e9";
      context.fillRect(0, 0, thumbnail.width, thumbnail.height);
      image = thumbnail.toDataURL("image/jpeg", 0.75);
    }
    return image.length < 90_000 ? image : undefined;
  } catch {
    return;
  }
}
