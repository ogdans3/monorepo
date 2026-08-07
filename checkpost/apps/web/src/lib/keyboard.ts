/**
 * Keeps the composer sitting on top of the on-screen keyboard.
 *
 * `interactive-widget=resizes-content` in the viewport meta handles this on
 * Chrome and Android. iOS Safari ignores it and instead scrolls the whole page
 * under a keyboard that overlaps the layout, which is the single most common
 * way a mobile web app ends up with its text field hidden behind the thing you
 * are typing on.
 *
 * The fix is to measure the visual viewport and publish the overlap as a CSS
 * variable the layout can pad with.
 */
export function trackKeyboard(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  const update = () => {
    // How much of the layout viewport the keyboard is covering.
    const overlap = Math.max(
      0,
      window.innerHeight - viewport.height - viewport.offsetTop,
    );
    document.documentElement.style.setProperty('--keyboard', `${Math.round(overlap)}px`);
  };

  update();
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    document.documentElement.style.removeProperty('--keyboard');
  };
}
