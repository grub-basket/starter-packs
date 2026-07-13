/** Force always-visible scrollbars while any Starter Packs modal is open.
 *
 * On macOS's default "show scroll bars when scrolling" setting, scrollbars are
 * overlay bars that fade out, and per-element `::-webkit-scrollbar` CSS can't
 * override that. Obsidian's own always-visible mode is gated behind the global
 * `body.styled-scrollbars` class, so the only reliable lever is to toggle that
 * class. We do it reference-counted (so nested modals work) and only remove it
 * if WE added it — if the user already runs styled scrollbars globally, we
 * leave their setting untouched. */

const CLASS = "styled-scrollbars";
let openCount = 0;
let addedByUs = false;

export function acquireStyledScrollbars(): void {
  openCount++;
  if (openCount === 1 && !document.body.classList.contains(CLASS)) {
    document.body.classList.add(CLASS);
    addedByUs = true;
  }
}

export function releaseStyledScrollbars(): void {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0 && addedByUs) {
    document.body.classList.remove(CLASS);
    addedByUs = false;
  }
}

/** Safety net for plugin unload while a modal is somehow still open. */
export function resetStyledScrollbars(): void {
  if (addedByUs) document.body.classList.remove(CLASS);
  openCount = 0;
  addedByUs = false;
}
