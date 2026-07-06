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
      .trim() || "Untitled"
  );
}

/** Create a note under the "Starter Packs" folder without ever overwriting: on
 * a name clash it walks to the next free ` N` suffix, in keeping with the
 * plugin's archive-not-destroy stance. Creates the folder if missing. */
export async function writeUniqueNote(app: App, baseName: string, content: string): Promise<TFile> {
  const folder = normalizePath(FOLDER);
  if (!app.vault.getAbstractFileByPath(folder)) {
    // Ignore an "already exists" race with another concurrent write.
    await app.vault.createFolder(folder).catch(() => {});
  }
  const base = sanitize(baseName);
  let path = normalizePath(`${folder}/${base}.md`);
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${folder}/${base} ${n}.md`);
    n++;
  }
  return app.vault.create(path, content);
}

/** Write a pack out as a readable note (the markdown share form: every plugin
 * linked, plus the import link + code so the note is itself re-importable). */
export async function exportPackAsNote(app: App, pack: StarterPack): Promise<TFile> {
  return writeUniqueNote(app, pack.name, packToMarkdown(pack));
}
