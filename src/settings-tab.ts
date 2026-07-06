import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { copyToClipboard } from "./catalog";
import { ManagePacksModal } from "./manager-modal";
import { VAULT_REPLICATION_CHECKLIST, saveChecklistNote } from "./vault-checklist";
import type StarterPacksPlugin from "./main";

export class StarterPacksSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: StarterPacksPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Manage packs")
      .setDesc("Create, edit, share, and import starter packs.")
      .addButton((b) =>
        b
          .setButtonText("Open starter packs")
          .setCta()
          .onClick(() => new ManagePacksModal(this.app, this.plugin).open())
      );

    new Setting(this.containerEl)
      .setName("Your name")
      .setDesc("Pre-filled as the author when you create a new pack.")
      .addText((t) =>
        t.setValue(this.plugin.settings.defaultAuthor).onChange(async (v) => {
          this.plugin.settings.defaultAuthor = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(this.containerEl)
      .setName("Direct install")
      .setDesc(
        "Install plugins straight from their GitHub releases when importing a pack. When off, Install buttons open each plugin's page in the community browser instead."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.directInstall).onChange(async (v) => {
          this.plugin.settings.directInstall = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(this.containerEl)
      .setName("Enable after install")
      .setDesc(
        "Turn plugins on right after installing them from a pack. Off by default for safety — installed plugins stay disabled until you review them and use the pack's “Enable all” button (or the per-plugin Enable). Only turn this on for packs you fully trust."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableAfterInstall).onChange(async (v) => {
          this.plugin.settings.enableAfterInstall = v;
          await this.plugin.saveSettings();
        })
      );

    this.renderHelp();
  }

  /** Help / limitations / security block — explains what a pack does and does
   * NOT carry, the trust model, and points at the DIY vault-replication
   * checklist for everything Starter Packs deliberately leaves out. */
  private renderHelp(): void {
    const c = this.containerEl;
    c.createEl("h3", { text: "Help & limitations" });

    const intro = c.createEl("p", { cls: "setting-item-description" });
    intro.setText(
      "A starter pack is just a curated list of community plugins and themes. When someone imports it, Obsidian installs those from their official sources — nothing else travels with the pack."
    );

    const notInc = c.createEl("div", { cls: "setting-item-description" });
    notInc.createEl("strong", { text: "A pack does NOT include:" });
    const ul = notInc.createEl("ul");
    [
      "Your plugin settings — each plugin's data.json. Recipients get a fresh install with defaults.",
      "CSS snippets — they have no community store to install from.",
      "Hotkeys, appearance/theme configuration, core-plugin settings, or anything else in your .obsidian folder.",
      "Anything not published to a community catalog (beta/BRAT plugins, private themes) — shown but flagged as not auto-installable.",
    ].forEach((t) => ul.createEl("li", { text: t }));

    const sec = c.createEl("div", { cls: "setting-item-description" });
    sec.createEl("strong", { text: "Security:" });
    const ul2 = sec.createEl("ul");
    [
      "Community plugins run with full access to your vault (files and network). Only import packs from people you trust.",
      "Installed plugins are disabled by default — review them, then use “Enable all”.",
      "A pack itself can't run code; the risk is in the plugins it points to.",
    ].forEach((t) => ul2.createEl("li", { text: t }));

    new Setting(c)
      .setName("Replicating a whole vault (settings, snippets, hotkeys)")
      .setDesc(
        "Starter Packs deliberately doesn't copy your config — bundling settings can leak secrets (API keys/tokens in plugin data.json) and machine-specific paths. To carry a full setup, zip your .obsidian folder yourself. This checklist walks you through it safely (offline)."
      )
      .addButton((b) =>
        b.setButtonText("Copy checklist").onClick(() => {
          void copyToClipboard(VAULT_REPLICATION_CHECKLIST, "Vault replication checklist");
        })
      )
      .addButton((b) =>
        b
          .setButtonText("Save as note")
          .setCta()
          .onClick(async () => {
            try {
              const file = await saveChecklistNote(this.app);
              new Notice(`[Starter Packs] Checklist saved to ${file.path}`);
              await this.app.workspace.getLeaf(true).openFile(file);
            } catch (e) {
              new Notice(`[Starter Packs] Couldn't save checklist: ${e instanceof Error ? e.message : e}`, 8000);
            }
          })
      );
  }
}
