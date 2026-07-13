import { App, Modal } from "obsidian";
import { acquireStyledScrollbars, releaseStyledScrollbars } from "./scrollbars";

/** Minimal promise-based confirm dialog. */
export class ConfirmModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private title: string,
    private body: string,
    private ctaText: string,
    private onResult: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    acquireStyledScrollbars();
    this.titleEl.setText(this.title);
    this.contentEl.createEl("p", { text: this.body });
    const row = this.contentEl.createDiv({ cls: "starter-packs-button-row" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: this.ctaText, cls: "mod-cta" });
    ok.addEventListener("click", () => {
      this.resolved = true;
      this.onResult(true);
      this.close();
    });
  }

  onClose(): void {
    releaseStyledScrollbars();
    if (!this.resolved) this.onResult(false);
    this.contentEl.empty();
  }
}

export function confirm(app: App, title: string, body: string, ctaText: string): Promise<boolean> {
  return new Promise((resolve) => new ConfirmModal(app, title, body, ctaText, resolve).open());
}
