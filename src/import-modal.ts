import { App, Modal, Notice } from "obsidian";
import {
  CatalogEntry,
  canDirectInstall,
  enablePlugin,
  fetchCatalog,
  installPluginDirect,
  openPluginPage,
  pluginStatus,
} from "./catalog";
import { confirm } from "./confirm-modal";
import { decodePackInput } from "./encoding";
import { StarterPack } from "./types";
import type StarterPacksPlugin from "./main";

/** Receiving side: paste a link/code (or arrive pre-loaded from an
 * obsidian:// link), preview the pack, and install what's missing. */
export class ImportPackModal extends Modal {
  private pack: StarterPack | null;
  private catalog: Map<string, CatalogEntry> | null = null;
  private busy = new Set<string>();
  private listEl: HTMLElement | null = null;

  constructor(
    app: App,
    private plugin: StarterPacksPlugin,
    preloaded?: StarterPack,
    /** Record into "Shared with me" on open — true for fresh arrivals (protocol
     * link), false when re-opening an already-recorded pack. */
    private recordOnOpen = false
  ) {
    super(app);
    this.pack = preloaded ?? null;
  }

  onOpen(): void {
    this.modalEl.addClass("starter-packs-modal");
    if (this.pack) {
      if (this.recordOnOpen) this.recordImport();
      this.showPack();
    } else {
      this.showPasteForm();
    }
  }

  // -- paste form ------------------------------------------------------------

  private showPasteForm(): void {
    this.contentEl.empty();
    this.titleEl.setText("Import a starter pack");
    this.contentEl.createEl("p", {
      text: "Paste a starter pack link (obsidian://…) or code (OSP1:…).",
    });
    const ta = this.contentEl.createEl("textarea", { cls: "starter-packs-share-value" });
    ta.rows = 4;
    ta.placeholder = "obsidian://starter-packs?d=…  or  OSP1:…";

    const errEl = this.contentEl.createDiv({ cls: "starter-packs-error" });
    const row = this.contentEl.createDiv({ cls: "starter-packs-button-row" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const preview = row.createEl("button", { text: "Preview pack", cls: "mod-cta" });
    const doPreview = () => {
      try {
        this.pack = decodePackInput(ta.value);
        this.recordImport();
        this.showPack();
      } catch (e) {
        errEl.setText(e instanceof Error ? e.message : String(e));
      }
    };
    preview.addEventListener("click", doPreview);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doPreview();
    });
    window.setTimeout(() => ta.focus(), 0);
  }

  /** Keep a record so the pack can be re-opened later from the manager. */
  private recordImport(): void {
    if (!this.pack) return;
    const dupe = this.plugin.settings.importedPacks.find(
      (r) =>
        r.pack.name === this.pack!.name &&
        r.pack.author === this.pack!.author &&
        r.pack.plugins.length === this.pack!.plugins.length &&
        r.pack.plugins.every((p, i) => p.id === this.pack!.plugins[i].id)
    );
    if (dupe) {
      dupe.importedAt = new Date().toISOString();
    } else {
      this.plugin.settings.importedPacks.unshift({
        pack: this.pack,
        importedAt: new Date().toISOString(),
      });
    }
    void this.plugin.saveSettings();
  }

  // -- pack preview ----------------------------------------------------------

  private showPack(): void {
    const pack = this.pack!;
    this.contentEl.empty();
    this.titleEl.setText(pack.name);

    const meta = this.contentEl.createDiv({ cls: "starter-packs-share-meta" });
    const by = pack.author ? `Shared by ${pack.author} · ` : "";
    meta.setText(`${by}${pack.plugins.length} plugin${pack.plugins.length === 1 ? "" : "s"}`);
    if (pack.description) {
      this.contentEl.createEl("p", { text: pack.description, cls: "starter-packs-share-desc" });
    }

    const actions = this.contentEl.createDiv({ cls: "starter-packs-button-row starter-packs-import-actions" });
    const installAll = actions.createEl("button", { text: "Install all missing", cls: "mod-cta" });
    installAll.addEventListener("click", () => void this.installAllMissing());
    const refresh = actions.createEl("button", { text: "Refresh status" });
    refresh.addEventListener("click", () => this.renderList());

    this.listEl = this.contentEl.createDiv({ cls: "starter-packs-plugin-list" });
    this.renderList();

    // Catalog arrives async; re-render rows once it's here so unknown ids get flagged.
    void fetchCatalog()
      .then((c) => {
        this.catalog = c;
        this.renderList();
      })
      .catch(() => {
        // Offline / rate-limited: statuses still work, direct install won't.
        this.catalog = null;
        if (this.listEl) {
          this.contentEl
            .createDiv({ cls: "starter-packs-error" })
            .setText("Couldn't load the community catalog (offline?). You can still open each plugin's page.");
        }
      });
  }

  private renderList(): void {
    const pack = this.pack!;
    const listEl = this.listEl!;
    listEl.empty();
    for (const p of pack.plugins) {
      const row = listEl.createDiv({ cls: "starter-packs-plugin-row" });
      const label = row.createDiv({ cls: "starter-packs-plugin-label" });
      label.createDiv({ text: p.name, cls: "starter-packs-plugin-name" });
      label.createDiv({
        text: p.author ? `${p.id} — ${p.author}` : p.id,
        cls: "starter-packs-plugin-meta",
      });

      const status = pluginStatus(this.app, p.id);
      const inCatalog = this.catalog ? this.catalog.has(p.id) : null;
      const badge = row.createSpan({ cls: `starter-packs-badge starter-packs-badge-${status}` });
      badge.setText(
        status === "enabled" ? "Enabled" : status === "disabled" ? "Installed (off)" : "Not installed"
      );
      if (status === "not-installed" && inCatalog === false) {
        badge.setText("Not in catalog");
        badge.addClass("starter-packs-badge-unknown");
      }

      const btns = row.createDiv({ cls: "starter-packs-row-buttons" });
      if (status === "not-installed" && inCatalog !== false) {
        const install = btns.createEl("button", { text: "Install", cls: "mod-cta" });
        if (this.busy.has(p.id)) {
          install.setText("Installing…");
          install.disabled = true;
        }
        install.addEventListener("click", () => void this.installOne(p.id, p.name));
      }
      if (status === "disabled") {
        const en = btns.createEl("button", { text: "Enable" });
        en.addEventListener("click", () => void this.enableOne(p.id, p.name));
      }
      const view = btns.createEl("button", { text: "View" });
      view.setAttribute("aria-label", "Open in the community plugin browser");
      view.addEventListener("click", () => openPluginPage(p.id));
    }
  }

  private async installOne(id: string, name: string): Promise<void> {
    if (this.busy.has(id)) return;
    if (!this.plugin.settings.directInstall || !canDirectInstall(this.app)) {
      openPluginPage(id);
      return;
    }
    this.busy.add(id);
    this.renderList();
    try {
      const res = await installPluginDirect(this.app, id, {
        enable: this.plugin.settings.enableAfterInstall,
      });
      new Notice(`[Starter Packs] ${res.message}`);
    } catch (e) {
      new Notice(
        `[Starter Packs] Couldn't install ${name}: ${e instanceof Error ? e.message : e}. Opening its page instead.`,
        8000
      );
      openPluginPage(id);
    } finally {
      this.busy.delete(id);
      this.renderList();
    }
  }

  private async enableOne(id: string, name: string): Promise<void> {
    const ok = await enablePlugin(this.app, id).catch(() => false);
    new Notice(
      ok
        ? `[Starter Packs] Enabled ${name}`
        : `[Starter Packs] Couldn't enable ${name} — turn it on in Settings → Community plugins`
    );
    this.renderList();
  }

  private async installAllMissing(): Promise<void> {
    const pack = this.pack!;
    const missing = pack.plugins.filter((p) => pluginStatus(this.app, p.id) === "not-installed");
    if (!missing.length) {
      new Notice("[Starter Packs] Nothing to install — everything is already here");
      return;
    }
    if (!this.plugin.settings.directInstall || !canDirectInstall(this.app)) {
      new Notice(
        "[Starter Packs] Direct install is off — use the per-plugin View buttons to install from the community browser",
        8000
      );
      return;
    }
    const enable = this.plugin.settings.enableAfterInstall;
    const ok = await confirm(
      this.app,
      "Install all missing plugins?",
      `This downloads and installs ${missing.length} plugin${missing.length === 1 ? "" : "s"} from their GitHub releases${enable ? " and enables them" : ""}. Only install packs from people you trust — plugins run with full access to your vault.`,
      `Install ${missing.length}`
    );
    if (!ok) return;

    let done = 0;
    const failures: string[] = [];
    for (const p of missing) {
      this.busy.add(p.id);
      this.renderList();
      try {
        await installPluginDirect(this.app, p.id, { enable });
        done++;
      } catch (e) {
        failures.push(`${p.name}: ${e instanceof Error ? e.message : e}`);
      } finally {
        this.busy.delete(p.id);
        this.renderList();
      }
    }
    if (failures.length) {
      new Notice(
        `[Starter Packs] Installed ${done}/${missing.length}. Failed — ${failures.join("; ")}`,
        0
      );
    } else {
      new Notice(`[Starter Packs] ✅ Installed ${done} plugin${done === 1 ? "" : "s"} from "${pack.name}"`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
