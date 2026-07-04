import { App, TFile, normalizePath } from "obsidian";
import { packToMarkdown } from "./encoding";
import { StarterPack } from "./types";

const FOLDER = "Starter Packs";

/** Strip characters that are illegal in filenames across common OSes, plus
 * Obsidian's own reserved link chars. */
function sanitize(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#^[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Starter Pack"
  );
}

/** Write a pack out as a readable note (the markdown share form: every plugin
 * linked, plus the import link + code so the note is itself re-importable).
 * Never overwrites — on a name clash it picks the next free ` N` suffix, in
 * keeping with the plugin's archive-not-destroy stance. Returns the new file. */
export async function exportPackAsNote(app: App, pack: StarterPack): Promise<TFile> {
  const folder = normalizePath(FOLDER);
  if (!app.vault.getAbstractFileByPath(folder)) {
    // Ignore an "already exists" race with another concurrent export.
    await app.vault.createFolder(folder).catch(() => {});
  }
  const base = sanitize(pack.name);
  let path = normalizePath(`${folder}/${base}.md`);
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${folder}/${base} ${n}.md`);
    n++;
  }
  return app.vault.create(path, packToMarkdown(pack));
}
