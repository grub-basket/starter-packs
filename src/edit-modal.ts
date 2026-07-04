import { App, Modal, Notice, PluginManifest, Setting } from "obsidian";
import { randomId } from "./encoding";
import { PackPlugin, StarterPack } from "./types";
import type StarterPacksPlugin from "./main";

/** Create or edit a pack: name/author/description plus a searchable checklist
 * of the plugins installed in this vault. */
export class PackEditModal extends Modal {
  private name: string;
  private author: string;
  private description: string;
  private selected: Map<string, PackPlugin>;
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

    const row = this.contentEl.createDiv({ cls: "starter-packs-button-row" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const save = row.createEl("button", { text: "Save pack", cls: "mod-cta" });
    save.addEventListener("click", () => this.save());
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
    if (!this.selected.size) {
      new Notice("[Starter Packs] Pick at least one plugin");
      return;
    }
    const now = new Date().toISOString();
    // Keep list order stable/alphabetical by name for a tidy share preview.
    const plugins = [...this.selected.values()].sort((a, b) => a.name.localeCompare(b.name));
    let pack: StarterPack;
    if (this.existing) {
      pack = this.existing;
      pack.name = name;
      pack.author = this.author.trim();
      pack.description = this.description.trim();
      pack.plugins = plugins;
      pack.updatedAt = now;
    } else {
      pack = {
        id: randomId(),
        name,
        author: this.author.trim(),
        description: this.description.trim(),
        plugins,
        createdAt: now,
        updatedAt: now,
      };
      this.plugin.settings.packs.push(pack);
    }
    // Remember the author for next time.
    if (pack.author) this.plugin.settings.defaultAuthor = pack.author;
    await this.plugin.saveSettings();
    new Notice(`[Starter Packs] Saved "${pack.name}" (${pack.plugins.length} plugins)`);
    this.onSaved?.(pack);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
