import { App, Modal, Notice, PluginManifest, Setting } from "obsidian";
import { randomId } from "./encoding";
import { installedThemes } from "./theme-catalog";
import { PackPlugin, PackTheme, StarterPack } from "./types";
import type StarterPacksPlugin from "./main";

/** Create or edit a pack: name/author/description plus a searchable checklist
 * of the plugins installed in this vault, and a checklist of installed themes. */
export class PackEditModal extends Modal {
  private name: string;
  private author: string;
  private description: string;
  private selected: Map<string, PackPlugin>;
  private selectedThemes: Map<string, PackTheme>;
  private search = "";
  private listEl!: HTMLElement;
  private countEl!: HTMLElement;

  constructor(
    app: App,
    private plugin: StarterPacksPlugin,
    private existing: StarterPack | null,
    private onSaved?: (pack: StarterPack) => void
  ) {
    super(app);
    this.name = existing?.name ?? "";
    this.author = existing?.author ?? plugin.settings.defaultAuthor;
    this.description = existing?.description ?? "";
    this.selected = new Map((existing?.plugins ?? []).map((p) => [p.id, p]));
    this.selectedThemes = new Map((existing?.themes ?? []).map((t) => [t.name, t]));
  }

  private installedManifests(): PluginManifest[] {
    const manifests = (this.app as unknown as { plugins: { manifests: Record<string, PluginManifest> } })
      .plugins.manifests;
    return Object.values(manifests).sort((a, b) => a.name.localeCompare(b.name));
  }

  onOpen(): void {
    this.modalEl.addClass("starter-packs-modal");
    this.titleEl.setText(this.existing ? "Edit starter pack" : "New starter pack");

    new Setting(this.contentEl).setName("Pack name").addText((t) =>
      t
        .setPlaceholder("e.g. Academic writing essentials")
        .setValue(this.name)
        .onChange((v) => (this.name = v))
    );
    new Setting(this.contentEl)
      .setName("Your name")
      .setDesc("Shown to whoever imports the pack.")
      .addText((t) =>
        t.setPlaceholder("e.g. Human").setValue(this.author).onChange((v) => (this.author = v))
      );
    new Setting(this.contentEl).setName("Description").addTextArea((t) => {
      t.setPlaceholder("Optional — what this pack is for")
        .setValue(this.description)
        .onChange((v) => (this.description = v));
      t.inputEl.rows = 2;
    });

    // Plugin picker
    const pickerHeader = this.contentEl.createDiv({ cls: "starter-packs-picker-header" });
    pickerHeader.createEl("h3", { text: "Plugins in this vault" });
    this.countEl = pickerHeader.createSpan({ cls: "starter-packs-count" });

    const controls = this.contentEl.createDiv({ cls: "starter-packs-picker-controls" });
    const searchInput = controls.createEl("input", {
      type: "search",
      placeholder: "Filter plugins…",
    });
    searchInput.addEventListener("input", () => {
      this.search = searchInput.value.toLowerCase();
      this.renderList();
    });
    const selVisible = controls.createEl("button", { text: "Select visible" });
    selVisible.addEventListener("click", () => {
      for (const m of this.visibleManifests()) {
        this.selected.set(m.id, { id: m.id, name: m.name, author: m.author ?? "" });
      }
      this.renderList();
    });
    const clearBtn = controls.createEl("button", { text: "Clear selection" });
    clearBtn.addEventListener("click", () => {
      this.selected.clear();
      this.renderList();
    });

    this.listEl = this.contentEl.createDiv({ cls: "starter-packs-plugin-list" });
    this.renderList();

    this.renderThemePicker();

    const row = this.contentEl.createDiv({ cls: "starter-packs-button-row" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const save = row.createEl("button", { text: "Save pack", cls: "mod-cta" });
    save.addEventListener("click", () => void this.save());
  }

  /** Compact checklist of the community themes installed in this vault. A vault
   * usually has only a handful, so no search is needed. */
  private renderThemePicker(): void {
    const themes = installedThemes(this.app);
    const header = this.contentEl.createDiv({ cls: "starter-packs-picker-header" });
    header.createEl("h3", { text: "Themes in this vault" });
    if (!themes.length) {
      this.contentEl.createDiv({
        cls: "starter-packs-empty",
        text: "No community themes installed — install one from Appearance to include it.",
      });
      return;
    }
    const list = this.contentEl.createDiv({ cls: "starter-packs-plugin-list starter-packs-theme-list" });
    for (const t of themes) {
      const row = list.createDiv({ cls: "starter-packs-plugin-row" });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = this.selectedThemes.has(t.name);
      cb.addEventListener("change", () => {
        if (cb.checked) this.selectedThemes.set(t.name, { name: t.name, author: t.author });
        else this.selectedThemes.delete(t.name);
      });
      const label = row.createDiv({ cls: "starter-packs-plugin-label" });
      label.createDiv({ text: t.name, cls: "starter-packs-plugin-name" });
      label.createDiv({ text: t.author || "theme", cls: "starter-packs-plugin-meta" });
      label.addEventListener("click", () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
      });
    }
  }

  private visibleManifests(): PluginManifest[] {
    return this.installedManifests().filter(
      (m) =>
        !this.search ||
        m.name.toLowerCase().includes(this.search) ||
        m.id.toLowerCase().includes(this.search) ||
        (m.author ?? "").toLowerCase().includes(this.search)
    );
  }

  private renderList(): void {
    this.listEl.empty();
    const visible = this.visibleManifests();
    if (!visible.length) {
      this.listEl.createDiv({ cls: "starter-packs-empty", text: "No plugins match." });
    }
    for (const m of visible) {
      const row = this.listEl.createDiv({ cls: "starter-packs-plugin-row" });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = this.selected.has(m.id);
      cb.addEventListener("change", () => {
        if (cb.checked) this.selected.set(m.id, { id: m.id, name: m.name, author: m.author ?? "" });
        else this.selected.delete(m.id);
        this.updateCount();
      });
      const label = row.createDiv({ cls: "starter-packs-plugin-label" });
      label.createDiv({ text: m.name, cls: "starter-packs-plugin-name" });
      label.createDiv({
        text: m.author ? `${m.id} — ${m.author}` : m.id,
        cls: "starter-packs-plugin-meta",
      });
      label.addEventListener("click", () => {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
      });
    }
    this.updateCount();
  }

  private updateCount(): void {
    this.countEl.setText(`${this.selected.size} selected`);
  }

  private async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) {
      new Notice("[Starter Packs] Give the pack a name first");
      return;
    }
    if (!this.selected.size && !this.selectedThemes.size) {
      new Notice("[Starter Packs] Pick at least one plugin or theme");
      return;
    }
    const now = new Date().toISOString();
    // Keep list order stable/alphabetical by name for a tidy share preview.
    const plugins = [...this.selected.values()].sort((a, b) => a.name.localeCompare(b.name));
    const themes = [...this.selectedThemes.values()].sort((a, b) => a.name.localeCompare(b.name));
    let pack: StarterPack;
    if (this.existing) {
      pack = this.existing;
      pack.name = name;
      pack.author = this.author.trim();
      pack.description = this.description.trim();
      pack.plugins = plugins;
      pack.themes = themes;
      pack.updatedAt = now;
    } else {
      pack = {
        id: randomId(),
        name,
        author: this.author.trim(),
        description: this.description.trim(),
        plugins,
        themes,
        createdAt: now,
        updatedAt: now,
      };
      this.plugin.settings.packs.push(pack);
    }
    // Remember the author for next time.
    if (pack.author) this.plugin.settings.defaultAuthor = pack.author;
    await this.plugin.saveSettings();
    const themeBit = themes.length ? `, ${themes.length} theme${themes.length === 1 ? "" : "s"}` : "";
    new Notice(`[Starter Packs] Saved "${pack.name}" (${pack.plugins.length} plugins${themeBit})`);
    this.onSaved?.(pack);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
