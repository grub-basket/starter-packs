import { Notice, Plugin } from "obsidian";
import { PROTOCOL_ACTION, payloadToPack, parsePayload } from "./encoding";
import { PackEditModal } from "./edit-modal";
import { ImportPackModal } from "./import-modal";
import { ManagePacksModal } from "./manager-modal";
import { StarterPacksSettingTab } from "./settings-tab";
import { saveChecklistNote } from "./vault-checklist";
import { DEFAULT_SETTINGS, StarterPacksSettings } from "./types";

export default class StarterPacksPlugin extends Plugin {
  settings: StarterPacksSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Receiving side of a shared link: obsidian://starter-packs?d=<payload>
    this.registerObsidianProtocolHandler(PROTOCOL_ACTION, (params) => {
      try {
        const pack = payloadToPack(parsePayload((params.d ?? "").replace(/[^A-Za-z0-9_-]+/g, "")));
        new ImportPackModal(this.app, this, pack, true).open();
      } catch (e) {
        new Notice(
          `[Starter Packs] Couldn't open that pack link: ${e instanceof Error ? e.message : e}`,
          8000
        );
      }
    });

    this.addRibbonIcon("package-open", "Starter packs", () => {
      new ManagePacksModal(this.app, this).open();
    });

    this.addCommand({
      id: "manage-packs",
      name: "Manage packs",
      callback: () => new ManagePacksModal(this.app, this).open(),
    });
    this.addCommand({
      id: "create-pack",
      name: "Create a pack",
      callback: () => new PackEditModal(this.app, this, null).open(),
    });
    this.addCommand({
      id: "import-pack",
      name: "Import a pack (paste link or code)",
      callback: () => new ImportPackModal(this.app, this).open(),
    });
    this.addCommand({
      id: "vault-replication-checklist",
      name: "Create a vault replication checklist note",
      callback: async () => {
        try {
          const file = await saveChecklistNote(this.app);
          new Notice(`[Starter Packs] Checklist saved to ${file.path}`);
          await this.app.workspace.getLeaf(true).openFile(file);
        } catch (e) {
          new Notice(`[Starter Packs] Couldn't save checklist: ${e instanceof Error ? e.message : e}`, 8000);
        }
      },
    });

    this.addSettingTab(new StarterPacksSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<StarterPacksSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
    // Defensive init for arrays — older data.json versions may lack them.
    this.settings.packs ??= [];
    this.settings.archivedPacks ??= [];
    this.settings.importedPacks ??= [];
    // `themes` was added after the first release; backfill it on every stored
    // pack so nothing downstream has to guard against `undefined`.
    for (const pack of this.settings.packs) pack.themes ??= [];
    for (const pack of this.settings.archivedPacks) pack.themes ??= [];
    for (const rec of this.settings.importedPacks) rec.pack.themes ??= [];
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
