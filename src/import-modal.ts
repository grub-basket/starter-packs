import { App, Modal, Notice } from "obsidian";
import {
  CatalogEntry,
  canDirectInstall,
  disablePlugin,
  enablePlugin,
  fetchCatalog,
  installPluginDirect,
  openPluginPage,
  pluginStatus,
} from "./catalog";
import { confirm } from "./confirm-modal";
import { decodePackInput } from "./encoding";
import {
  ThemeCatalogEntry,
  applyTheme,
  canManageThemes,
  fetchThemeCatalog,
  installThemeFromCatalog,
  themeStatus,
} from "./theme-catalog";
import { StarterPack } from "./types";
import type StarterPacksPlugin from "./main";

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Receiving side: paste a link/code (or arrive pre-loaded from an
 * obsidian:// link), preview the pack, and install what's missing. */
export class ImportPackModal extends Modal {
  private pack: StarterPack | null;
  private catalog: Map<string, CatalogEntry> | null = null;
  private themeCatalog: Map<string, ThemeCatalogEntry> | null = null;
  private busy = new Set<string>();
  private listEl: HTMLElement | null = null;
  private themeListEl: HTMLElement | null = null;
  private progressHost: HTMLElement | null = null;
  private installAllBtn: HTMLButtonElement | null = null;
  private installing = false;

  /** Gap between installs. GitHub's *primary* rate limit (60 unauthenticated
   * req/hr) is a fixed count regardless of pacing, but its *secondary* abuse
   * limits punish rapid bursts — so spacing the release lookups out makes a
   * multi-plugin install far less likely to get throttled, and gives the user
   * a visible, non-frantic progress cadence. */
  private static readonly STAGGER_MS = 1200;

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
    const themeBit = pack.themes.length ? ` · ${pack.themes.length} theme${pack.themes.length === 1 ? "" : "s"}` : "";
    meta.setText(`${by}${pack.plugins.length} plugin${pack.plugins.length === 1 ? "" : "s"}${themeBit}`);
    if (pack.description) {
      this.contentEl.createEl("p", { text: pack.description, cls: "starter-packs-share-desc" });
    }

    const actions = this.contentEl.createDiv({ cls: "starter-packs-button-row starter-packs-import-actions" });
    const installAll = actions.createEl("button", { text: "Install all missing", cls: "mod-cta" });
    installAll.addEventListener("click", () => void this.installAllMissing());
    this.installAllBtn = installAll;
    const refresh = actions.createEl("button", { text: "Refresh status" });
    refresh.addEventListener("click", () => this.redraw());

    // Mass enable/disable for the pack's installed plugins. Plugins are
    // installed disabled by default (safer), so this is how the user turns the
    // whole set on after reviewing it — or off again.
    if (pack.plugins.length) {
      const enableAll = actions.createEl("button", { text: "Enable all" });
      enableAll.addEventListener("click", () => void this.setAllEnabled(true));
      const disableAll = actions.createEl("button", { text: "Disable all" });
      disableAll.addEventListener("click", () => void this.setAllEnabled(false));
    }

    // Progress bar host — stays empty (and collapsed) until an install run.
    this.progressHost = this.contentEl.createDiv({ cls: "starter-packs-progress" });

    if (pack.plugins.length) {
      this.contentEl.createEl("h3", { text: "Plugins", cls: "starter-packs-section-h" });
      this.listEl = this.contentEl.createDiv({ cls: "starter-packs-plugin-list" });
    }
    if (pack.themes.length) {
      this.contentEl.createEl("h3", { text: "Themes", cls: "starter-packs-section-h" });
      this.themeListEl = this.contentEl.createDiv({ cls: "starter-packs-plugin-list" });
    }
    this.redraw();

    // Catalogs arrive async; re-render once they're here so unknown ids/names
    // get flagged and direct-install becomes available.
    void fetchCatalog()
      .then((c) => {
        this.catalog = c;
        this.renderList();
      })
      .catch(() => {
        this.catalog = null;
        if (this.listEl) {
          this.contentEl
            .createDiv({ cls: "starter-packs-error" })
            .setText("Couldn't load the community catalog (offline?). You can still open each plugin's page.");
        }
      });
    if (pack.themes.length) {
      void fetchThemeCatalog()
        .then((c) => {
          this.themeCatalog = c;
          this.renderThemes();
        })
        .catch(() => {
          this.themeCatalog = null;
        });
    }
  }

  private redraw(): void {
    this.renderList();
    this.renderThemes();
  }

  private renderList(): void {
    const pack = this.pack!;
    const listEl = this.listEl;
    if (!listEl) return;
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
        status === "enabled"
          ? "Enabled"
          : status === "disabled"
            ? "Installed (Disabled)"
            : "Not installed"
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

  /** Busy-set key for a theme (namespaced so a theme name can't collide with a
   * plugin id). */
  private themeKey(name: string): string {
    return `theme:${name}`;
  }

  private renderThemes(): void {
    const pack = this.pack!;
    const listEl = this.themeListEl;
    if (!listEl) return;
    listEl.empty();
    for (const t of pack.themes) {
      const row = listEl.createDiv({ cls: "starter-packs-plugin-row" });
      const label = row.createDiv({ cls: "starter-packs-plugin-label" });
      label.createDiv({ text: t.name, cls: "starter-packs-plugin-name" });
      label.createDiv({ text: t.author ? `${t.author} · theme` : "theme", cls: "starter-packs-plugin-meta" });

      const status = themeStatus(this.app, t.name);
      const inCatalog = this.themeCatalog ? this.themeCatalog.has(t.name) : null;
      const badgeClass = status === "active" ? "enabled" : status === "installed" ? "disabled" : "not-installed";
      const badge = row.createSpan({ cls: `starter-packs-badge starter-packs-badge-${badgeClass}` });
      badge.setText(status === "active" ? "Active" : status === "installed" ? "Installed" : "Not installed");
      if (status === "not-installed" && inCatalog === false) {
        badge.setText("Not in catalog");
        badge.addClass("starter-packs-badge-unknown");
      }

      const btns = row.createDiv({ cls: "starter-packs-row-buttons" });
      const canInstall = this.plugin.settings.directInstall && canManageThemes(this.app);
      if (status === "not-installed" && inCatalog !== false && canInstall) {
        const install = btns.createEl("button", { text: "Install", cls: "mod-cta" });
        if (this.busy.has(this.themeKey(t.name))) {
          install.setText("Installing…");
          install.disabled = true;
        }
        install.addEventListener("click", () => void this.installOneTheme(t.name));
      }
      // "Apply" for an installed-but-inactive theme (Obsidian allows one active
      // theme at a time, so only offer it when it isn't already active).
      if (status === "installed") {
        const apply = btns.createEl("button", { text: "Apply" });
        apply.addEventListener("click", () => {
          if (applyTheme(this.app, t.name)) new Notice(`[Starter Packs] Applied theme ${t.name}`);
          this.renderThemes();
        });
      }
    }
  }

  private async installOneTheme(name: string): Promise<void> {
    const key = this.themeKey(name);
    if (this.busy.has(key)) return;
    if (!this.plugin.settings.directInstall || !canManageThemes(this.app)) {
      new Notice("[Starter Packs] Install themes from Settings → Appearance in this Obsidian version", 8000);
      return;
    }
    this.busy.add(key);
    this.renderThemes();
    try {
      const res = await installThemeFromCatalog(this.app, name, { apply: false });
      new Notice(`[Starter Packs] ${res.message}`);
    } catch (e) {
      new Notice(`[Starter Packs] Couldn't install theme ${name}: ${e instanceof Error ? e.message : e}`, 8000);
    } finally {
      this.busy.delete(key);
      this.renderThemes();
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

  /** Enable (or disable) every INSTALLED plugin in this pack at once. Only
   * touches plugins whose current state differs — not-installed ones are left
   * alone. Themes are unaffected (Obsidian has one active theme, not a set). */
  private async setAllEnabled(enable: boolean): Promise<void> {
    const pack = this.pack!;
    const want = enable ? "disabled" : "enabled"; // the state we flip FROM
    const targets = pack.plugins.filter((p) => pluginStatus(this.app, p.id) === want);
    if (!targets.length) {
      new Notice(`[Starter Packs] No installed plugins to ${enable ? "enable" : "disable"}`);
      return;
    }
    let done = 0;
    const failures: string[] = [];
    for (const p of targets) {
      const ok = enable
        ? await enablePlugin(this.app, p.id).catch(() => false)
        : await disablePlugin(this.app, p.id).catch(() => false);
      if (ok) done++;
      else failures.push(p.name);
      this.redraw();
    }
    const verb = enable ? "Enabled" : "Disabled";
    if (failures.length) {
      new Notice(
        `[Starter Packs] ${verb} ${done}/${targets.length}. Couldn't ${enable ? "enable" : "disable"}: ${failures.join(", ")}`,
        8000
      );
    } else {
      new Notice(`[Starter Packs] ${verb} ${done} plugin${done === 1 ? "" : "s"}`);
    }
    this.redraw();
  }

  private async installAllMissing(): Promise<void> {
    if (this.installing) return;
    const pack = this.pack!;
    if (!this.plugin.settings.directInstall) {
      new Notice(
        "[Starter Packs] Direct install is off — use the per-row View/Install buttons instead",
        8000
      );
      return;
    }
    const enable = this.plugin.settings.enableAfterInstall;

    // Unified work list: missing plugins first, then missing themes. Known
    // not-in-catalog items are skipped (they can't be auto-installed anyway).
    const work: { label: string; key: string; run: () => Promise<void> }[] = [];
    if (canDirectInstall(this.app)) {
      for (const p of pack.plugins) {
        if (pluginStatus(this.app, p.id) !== "not-installed") continue;
        if (this.catalog && !this.catalog.has(p.id)) continue;
        work.push({
          label: p.name,
          key: p.id,
          run: () => installPluginDirect(this.app, p.id, { enable }).then(() => undefined),
        });
      }
    }
    if (canManageThemes(this.app)) {
      for (const t of pack.themes) {
        if (themeStatus(this.app, t.name) !== "not-installed") continue;
        if (this.themeCatalog && !this.themeCatalog.has(t.name)) continue;
        work.push({
          label: t.name,
          key: this.themeKey(t.name),
          run: () => installThemeFromCatalog(this.app, t.name, { apply: false }).then(() => undefined),
        });
      }
    }

    if (!work.length) {
      new Notice("[Starter Packs] Nothing to install — everything is already here (or not directly installable)");
      return;
    }

    const nPlugins = work.filter((w) => !w.key.startsWith("theme:")).length;
    const nThemes = work.length - nPlugins;
    const parts = [
      nPlugins ? `${nPlugins} plugin${nPlugins === 1 ? "" : "s"}${enable ? " (enabled)" : ""}` : "",
      nThemes ? `${nThemes} theme${nThemes === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    const ok = await confirm(
      this.app,
      "Install all missing?",
      `This downloads and installs ${parts.join(" and ")} one at a time. Only install packs from people you trust — plugins run with full access to your vault.`,
      `Install ${work.length}`
    );
    if (!ok) return;

    this.installing = true;
    const total = work.length;
    let done = 0;
    const failures: string[] = [];

    // Persistent toast so progress + completion still reach the user if they
    // close the modal mid-run. Updated in place each step.
    const notice = new Notice("", 0);
    const setNotice = (msg: string) => {
      try {
        notice.setMessage(`[Starter Packs] ${msg}`);
      } catch {
        notice.messageEl?.setText(`[Starter Packs] ${msg}`);
      }
    };

    if (this.installAllBtn) {
      this.installAllBtn.disabled = true;
      this.installAllBtn.setText("Installing…");
    }

    try {
      for (let i = 0; i < work.length; i++) {
        const item = work[i];
        this.renderProgress(done, total, item.label);
        setNotice(`Installing ${item.label} — ${i + 1} of ${total}…`);
        this.busy.add(item.key);
        this.redraw();
        try {
          await item.run();
          done++;
        } catch (e) {
          failures.push(`${item.label}: ${e instanceof Error ? e.message : e}`);
        } finally {
          this.busy.delete(item.key);
          this.redraw();
        }
        this.renderProgress(done, total, null);
        // Stagger between installs (skip the wait after the last one).
        if (i < work.length - 1) await sleep(ImportPackModal.STAGGER_MS);
      }
    } finally {
      this.installing = false;
      if (this.installAllBtn) {
        this.installAllBtn.disabled = false;
        this.installAllBtn.setText("Install all missing");
      }
      this.progressHost?.empty();
    }

    if (failures.length) {
      // Persistent (0) so the user can read what failed and dismiss it.
      setNotice(`Installed ${done}/${total} from "${pack.name}". Failed — ${failures.join("; ")}`);
    } else {
      setNotice(`✅ All ${done} item${done === 1 ? "" : "s"} from "${pack.name}" installed — ready to use`);
      window.setTimeout(() => notice.hide(), 6000);
    }
  }

  /** Render the in-modal progress bar. `currentName` non-null = a step is in
   * flight; null = between/after steps. */
  private renderProgress(done: number, total: number, currentName: string | null): void {
    const host = this.progressHost;
    if (!host) return;
    host.empty();
    const pct = total ? Math.round((done / total) * 100) : 0;
    const text = host.createDiv({ cls: "starter-packs-progress-text" });
    text.setText(
      currentName ? `Installing ${currentName} — ${done + 1} of ${total}…` : `${done} of ${total} installed`
    );
    const bar = host.createDiv({ cls: "starter-packs-progress-bar" });
    const fill = bar.createDiv({ cls: "starter-packs-progress-fill" });
    fill.style.width = `${pct}%`;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
