import { App, Modal, Notice } from "obsidian";
import { confirm } from "./confirm-modal";
import { PackEditModal } from "./edit-modal";
import { randomId } from "./encoding";
import { ImportPackModal } from "./import-modal";
import { SharePackModal } from "./share-modal";
import { StarterPack } from "./types";
import type StarterPacksPlugin from "./main";

/** "N plugins" / "N plugins, M themes" / "M themes" — never a bare "0 plugins"
 * for a theme-only pack. */
function packContents(pack: StarterPack): string {
  const parts: string[] = [];
  if (pack.plugins.length || !pack.themes.length) {
    parts.push(`${pack.plugins.length} plugin${pack.plugins.length === 1 ? "" : "s"}`);
  }
  if (pack.themes.length) {
    parts.push(`${pack.themes.length} theme${pack.themes.length === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/** Home surface: your packs (share/edit/duplicate/archive), packs shared with
 * you, and an archived section with restore. Nothing here hard-deletes. */
export class ManagePacksModal extends Modal {
  constructor(app: App, private plugin: StarterPacksPlugin) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("starter-packs-modal");
    this.render();
  }

  private render(): void {
    const s = this.plugin.settings;
    this.contentEl.empty();
    this.titleEl.setText("Starter packs");

    const topRow = this.contentEl.createDiv({ cls: "starter-packs-button-row starter-packs-top-row" });
    const newBtn = topRow.createEl("button", { text: "New pack", cls: "mod-cta" });
    newBtn.addEventListener("click", () => {
      new PackEditModal(this.app, this.plugin, null, () => this.render()).open();
    });
    const importBtn = topRow.createEl("button", { text: "Import a pack" });
    importBtn.addEventListener("click", () => {
      this.close();
      new ImportPackModal(this.app, this.plugin).open();
    });

    // -- my packs
    this.contentEl.createEl("h3", { text: "My packs" });
    if (!s.packs.length) {
      this.contentEl.createDiv({
        cls: "starter-packs-empty",
        text: "No packs yet — create one and pick plugins from this vault.",
      });
    }
    for (const pack of s.packs) {
      const row = this.contentEl.createDiv({ cls: "starter-packs-pack-row" });
      const label = row.createDiv({ cls: "starter-packs-plugin-label" });
      label.createDiv({ text: pack.name, cls: "starter-packs-plugin-name" });
      const by = pack.author ? ` · ${pack.author}` : "";
      label.createDiv({
        text: `${packContents(pack)}${by} · updated ${pack.updatedAt.slice(0, 10)}`,
        cls: "starter-packs-plugin-meta",
      });
      const btns = row.createDiv({ cls: "starter-packs-row-buttons" });
      const share = btns.createEl("button", { text: "Share", cls: "mod-cta" });
      share.addEventListener("click", () => new SharePackModal(this.app, pack).open());
      const edit = btns.createEl("button", { text: "Edit" });
      edit.addEventListener("click", () =>
        new PackEditModal(this.app, this.plugin, pack, () => this.render()).open()
      );
      const dup = btns.createEl("button", { text: "Duplicate" });
      dup.addEventListener("click", () => void this.duplicate(pack));
      const archive = btns.createEl("button", { text: "Archive" });
      archive.addEventListener("click", () => void this.archive(pack));
    }

    // -- imported packs
    if (s.importedPacks.length) {
      this.contentEl.createEl("h3", { text: "Shared with me" });
      for (const rec of s.importedPacks) {
        const row = this.contentEl.createDiv({ cls: "starter-packs-pack-row" });
        const label = row.createDiv({ cls: "starter-packs-plugin-label" });
        label.createDiv({ text: rec.pack.name, cls: "starter-packs-plugin-name" });
        const by = rec.pack.author ? `by ${rec.pack.author} · ` : "";
        label.createDiv({
          text: `${by}${packContents(rec.pack)} · imported ${rec.importedAt.slice(0, 10)}`,
          cls: "starter-packs-plugin-meta",
        });
        const btns = row.createDiv({ cls: "starter-packs-row-buttons" });
        const open = btns.createEl("button", { text: "Open" });
        open.addEventListener("click", () => {
          this.close();
          new ImportPackModal(this.app, this.plugin, rec.pack).open();
        });
        const saveAsMine = btns.createEl("button", { text: "Save as mine" });
        saveAsMine.setAttribute("aria-label", "Copy into My packs so you can edit and re-share it");
        saveAsMine.addEventListener("click", () => void this.adoptImported(rec.pack));
      }
    }

    // -- archived
    if (s.archivedPacks.length) {
      this.contentEl.createEl("h3", { text: "Archived" });
      for (const pack of s.archivedPacks) {
        const row = this.contentEl.createDiv({ cls: "starter-packs-pack-row starter-packs-archived" });
        const label = row.createDiv({ cls: "starter-packs-plugin-label" });
        label.createDiv({ text: pack.name, cls: "starter-packs-plugin-name" });
        label.createDiv({
          text: packContents(pack),
          cls: "starter-packs-plugin-meta",
        });
        const btns = row.createDiv({ cls: "starter-packs-row-buttons" });
        const restore = btns.createEl("button", { text: "Restore" });
        restore.addEventListener("click", () => void this.restore(pack));
      }
    }
  }

  private async duplicate(pack: StarterPack): Promise<void> {
    const now = new Date().toISOString();
    const copy: StarterPack = {
      ...pack,
      id: randomId(),
      name: `${pack.name} (copy)`,
      plugins: pack.plugins.map((p) => ({ ...p })),
      themes: pack.themes.map((t) => ({ ...t })),
      createdAt: now,
      updatedAt: now,
    };
    this.plugin.settings.packs.push(copy);
    await this.plugin.saveSettings();
    this.render();
  }

  private async archive(pack: StarterPack): Promise<void> {
    const ok = await confirm(
      this.app,
      "Archive this pack?",
      `"${pack.name}" moves to the Archived section — you can restore it any time. Links/codes you've already shared keep working (they carry their own copy of the list).`,
      "Archive"
    );
    if (!ok) return;
    const s = this.plugin.settings;
    s.packs = s.packs.filter((p) => p.id !== pack.id);
    s.archivedPacks.unshift(pack);
    await this.plugin.saveSettings();
    this.render();
  }

  private async restore(pack: StarterPack): Promise<void> {
    const s = this.plugin.settings;
    s.archivedPacks = s.archivedPacks.filter((p) => p.id !== pack.id);
    s.packs.push(pack);
    await this.plugin.saveSettings();
    this.render();
  }

  private async adoptImported(pack: StarterPack): Promise<void> {
    const now = new Date().toISOString();
    const copy: StarterPack = {
      ...pack,
      id: randomId(),
      plugins: pack.plugins.map((p) => ({ ...p })),
      themes: pack.themes.map((t) => ({ ...t })),
      createdAt: now,
      updatedAt: now,
    };
    this.plugin.settings.packs.push(copy);
    await this.plugin.saveSettings();
    new Notice(`[Starter Packs] "${pack.name}" copied to My packs`);
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
