import { App, PluginSettingTab, Setting } from "obsidian";
import { ManagePacksModal } from "./manager-modal";
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
      .setDesc("Turn plugins on right after installing them from a pack.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableAfterInstall).onChange(async (v) => {
          this.plugin.settings.enableAfterInstall = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
