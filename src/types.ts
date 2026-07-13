/** A plugin entry inside a pack. Name/author are snapshotted at pack-creation
 * time so a recipient sees a readable list even offline / for delisted plugins. */
export interface PackPlugin {
  id: string;
  name: string;
  author: string;
  /** Optional author-written note about this specific plugin (per plugin). The
   * plugin's own name/description come from its manifest.json (or the community
   * catalog), so this is the ONE thing the author adds. */
  comment?: string;
  /** The author's enable intent — defaults to whether the plugin was enabled in
   * their vault when the pack was made, and can be overridden per plugin. This
   * is RECORD-ONLY on import: recipients still install disabled by default (see
   * enableAfterInstall); the flag just conveys what the author runs. Defaults to
   * true (omitted from the payload when true, to keep simple packs compact). */
  enabled?: boolean;
}

/** A community theme entry. Themes are keyed by display name (Obsidian has no
 * theme "id"); the repo is resolved from the community catalog at install time,
 * same as plugins. */
export interface PackTheme {
  name: string;
  author: string;
}

export interface StarterPack {
  /** Internal id (random), NOT part of the shared payload. */
  id: string;
  name: string;
  author: string;
  description: string;
  plugins: PackPlugin[];
  themes: PackTheme[];
  createdAt: string;
  updatedAt: string;
}

/** A pack someone shared with us, kept for re-opening later. */
export interface ImportedPackRecord {
  pack: StarterPack;
  importedAt: string;
}

export interface StarterPacksSettings {
  packs: StarterPack[];
  /** Archived instead of deleted — the user is delete-averse by design. */
  archivedPacks: StarterPack[];
  importedPacks: ImportedPackRecord[];
  /** Pre-filled as the author on new packs. */
  defaultAuthor: string;
  /** When false, Install buttons open the community-browser page instead of
   * downloading directly. */
  directInstall: boolean;
  /** Enable plugins right after installing them. Off by default: freshly
   * installed third-party code stays inert until the user reviews and enables
   * it (via the per-row Enable button or the preview's "Enable all"). */
  enableAfterInstall: boolean;
}

export const DEFAULT_SETTINGS: StarterPacksSettings = {
  packs: [],
  archivedPacks: [],
  importedPacks: [],
  defaultAuthor: "",
  directInstall: true,
  enableAfterInstall: false,
};

/** Shared payload (versioned). Field names are short on purpose — they ride
 * inside links/codes. p entries are [id, name, author]; t entries are
 * [name, author].
 *
 * `t` (themes) was added after the initial release as an OPTIONAL field and the
 * version stays `1` on purpose: a theme-carrying pack still decodes cleanly in
 * an older Starter Packs (it just ignores `t` and imports the plugins). Bumping
 * to v2 would make older installs reject the whole pack — strictly worse. Any
 * future *breaking* shape change is what earns a v2 (with v1 kept decodable). */
export interface PackPayloadV1 {
  v: 1;
  n: string; // pack name
  a: string; // pack author
  d?: string; // description
  /** Plugin entries. Positional + additive: [id, name, author, comment?,
   * enabled?]. Trailing defaults (empty comment, enabled=1) are trimmed so a
   * plain plugin stays [id, name, author] — old decoders keep reading the first
   * three and ignore the rest. `enabled` is 1|0; absent means 1 (enabled). The
   * plugin's description is NOT carried — it's read live from the manifest /
   * community catalog. */
  p: PluginTuple[];
  t?: [string, string][]; // themes [name, author]
}

export type PluginTuple =
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, 0 | 1];
