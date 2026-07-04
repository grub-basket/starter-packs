/** A plugin entry inside a pack. Name/author are snapshotted at pack-creation
 * time so a recipient sees a readable list even offline / for delisted plugins. */
export interface PackPlugin {
  id: string;
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
  /** Enable plugins right after installing them. */
  enableAfterInstall: boolean;
}

export const DEFAULT_SETTINGS: StarterPacksSettings = {
  packs: [],
  archivedPacks: [],
  importedPacks: [],
  defaultAuthor: "",
  directInstall: true,
  enableAfterInstall: true,
};

/** Shared payload (versioned). Field names are short on purpose — they ride
 * inside links/codes. p entries are [id, name, author]. */
export interface PackPayloadV1 {
  v: 1;
  n: string; // pack name
  a: string; // pack author
  d?: string; // description
  p: [string, string, string][];
}
