import { App, Modal, Notice } from "obsidian";
import { copyToClipboard } from "./catalog";
import { packToCode, packToLink, packToMarkdown } from "./encoding";
import { exportPackAsNote } from "./note-export";
import { StarterPack } from "./types";

/** Share surface for one pack: link, code, and markdown forms, each with a
 * one-click copy button and a visible fallback textarea. */
export class SharePackModal extends Modal {
  constructor(app: App, private pack: StarterPack) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("starter-packs-modal");
    this.titleEl.setText(`Share "${this.pack.name}"`);

    const meta = this.contentEl.createDiv({ cls: "starter-packs-share-meta" });
    const by = this.pack.author ? ` · by ${this.pack.author}` : "";
    meta.setText(`${this.pack.plugins.length} plugins${by}`);

    const actions = this.contentEl.createDiv({ cls: "starter-packs-button-row starter-packs-import-actions" });
    const exportBtn = actions.createEl("button", { text: "Export as note" });
    exportBtn.setAttribute("aria-label", "Write this pack into your vault as a readable, re-importable note");
    exportBtn.addEventListener("click", () => void this.exportAsNote());

    this.section(
      "Link",
      "Opens directly in Obsidian for anyone who has Starter Packs installed.",
      packToLink(this.pack),
      "Link"
    );
    this.section(
      "Code",
      "For places that mangle links — paste into Starter Packs → Import a pack.",
      packToCode(this.pack),
      "Code"
    );
    this.section(
      "Markdown",
      "A readable list for forums/notes: every plugin linked, with the import link and code included.",
      packToMarkdown(this.pack),
      "Markdown",
      6
    );
  }

  private section(title: string, desc: string, value: string, label: string, rows = 2): void {
    const wrap = this.contentEl.createDiv({ cls: "starter-packs-share-section" });
    const head = wrap.createDiv({ cls: "starter-packs-share-head" });
    head.createEl("h3", { text: title });
    const copyBtn = head.createEl("button", { text: `Copy ${label.toLowerCase()}`, cls: "mod-cta" });
    copyBtn.addEventListener("click", () => void copyToClipboard(value, label));
    wrap.createDiv({ cls: "starter-packs-share-desc", text: desc });
    const ta = wrap.createEl("textarea", { cls: "starter-packs-share-value" });
    ta.value = value;
    ta.rows = rows;
    ta.readOnly = true;
    ta.addEventListener("focus", () => ta.select());
  }

  private async exportAsNote(): Promise<void> {
    try {
      const file = await exportPackAsNote(this.app, this.pack);
      new Notice(`[Starter Packs] Exported to ${file.path}`);
      this.close();
      await this.app.workspace.getLeaf(true).openFile(file);
    } catch (e) {
      new Notice(`[Starter Packs] Couldn't export note: ${e instanceof Error ? e.message : e}`, 8000);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
