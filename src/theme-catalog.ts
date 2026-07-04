import { App, requestUrl } from "obsidian";

/** One entry from the official community-css-themes.json registry. */
export interface ThemeCatalogEntry {
  name: string;
  author: string;
  repo: string;
  screenshot?: string;
  modes?: string[];
  legacy?: boolean;
}

const THEME_CATALOG_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-css-themes.json";

/** The undocumented parts of app.customCss we rely on. Feature-detected at the
 * call sites — Obsidian can change these between releases. Themes are keyed by
 * display name (there is no theme "id"). */
interface ObsidianCustomCss {
  /** Installed themes, keyed by name → manifest ({name, author, version}). */
  themes: Record<string, { name: string; author?: string; version?: string }>;
  /** Active theme name; "" = the built-in default. */
  theme: string;
  isThemeInstalled?: (name: string) => boolean;
  installTheme?: (entry: ThemeCatalogEntry, version?: string) => Promise<void>;
  getManifest?: (repo: string) => Promise<{ version?: string } | null>;
  setTheme?: (name: string) => void;
}

function customCss(app: App): ObsidianCustomCss {
  return (app as unknown as { customCss: ObsidianCustomCss }).customCss;
}

/** True when this Obsidian build exposes the theme install/apply API. */
export function canManageThemes(app: App): boolean {
  const cc = customCss(app);
  return !!cc && typeof cc.installTheme === "function" && typeof cc.setTheme === "function";
}

let themeCache: Map<string, ThemeCatalogEntry> | null = null;
let themeFetchedAt = 0;
const THEME_TTL_MS = 30 * 60 * 1000;

export async function fetchThemeCatalog(): Promise<Map<string, ThemeCatalogEntry>> {
  const fresh = themeCache && Date.now() - themeFetchedAt < THEME_TTL_MS;
  if (themeCache && fresh) return themeCache;
  try {
    const res = await requestUrl({ url: THEME_CATALOG_URL });
    const list = res.json as ThemeCatalogEntry[];
    if (!Array.isArray(list)) throw new Error("Unexpected community theme catalog format");
    const map = new Map<string, ThemeCatalogEntry>();
    for (const e of list) if (e && e.name) map.set(e.name, e);
    themeCache = map;
    themeFetchedAt = Date.now();
    return map;
  } catch (e) {
    if (themeCache) return themeCache; // stale beats nothing
    throw new Error("Couldn't load the community theme catalog (offline or GitHub unavailable).");
  }
}

export type ThemeStatus = "active" | "installed" | "not-installed";

export function themeStatus(app: App, name: string): ThemeStatus {
  const cc = customCss(app);
  if (!cc) return "not-installed";
  const installed = cc.isThemeInstalled ? cc.isThemeInstalled(name) : !!cc.themes?.[name];
  if (!installed) return "not-installed";
  return cc.theme === name ? "active" : "installed";
}

/** The community themes installed in this vault (name + author), for the pack
 * editor's theme picker. Excludes the built-in default (which isn't a theme). */
export function installedThemes(app: App): { name: string; author: string }[] {
  const cc = customCss(app);
  if (!cc?.themes) return [];
  return Object.values(cc.themes)
    .map((m) => ({ name: m.name, author: m.author ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Switch the active theme. */
export function applyTheme(app: App, name: string): boolean {
  const cc = customCss(app);
  if (!cc?.setTheme) return false;
  cc.setTheme(name);
  return true;
}

export interface ThemeInstallResult {
  ok: boolean;
  message: string;
}

/** Install a community theme via Obsidian's own installer. Modern themes carry
 * a manifest.json with a version → installTheme(entry, version); older themes
 * have none → installTheme(entry), which routes to the legacy installer. Throws
 * a readable message on failure. */
export async function installThemeFromCatalog(
  app: App,
  name: string,
  opts: { apply: boolean }
): Promise<ThemeInstallResult> {
  const cc = customCss(app);
  if (!cc?.installTheme) throw new Error("Theme install isn't available in this Obsidian version.");

  const catalog = await fetchThemeCatalog();
  const entry = catalog.get(name);
  if (!entry) throw new Error(`Theme "${name}" isn't in the community catalog.`);

  let version: string | undefined;
  if (cc.getManifest) {
    try {
      const manifest = await cc.getManifest(entry.repo);
      version = manifest?.version;
    } catch {
      version = undefined; // fall through to the legacy path
    }
  }

  try {
    await cc.installTheme(entry, version);
  } catch (e) {
    throw new Error(
      `Couldn't download ${name} from ${entry.repo} (${e instanceof Error ? e.message : e}).`
    );
  }

  const installed = cc.isThemeInstalled ? cc.isThemeInstalled(name) : !!cc.themes?.[name];
  if (!installed) {
    throw new Error(`Install of ${name} didn't stick — try the Appearance settings instead.`);
  }

  if (opts.apply) {
    applyTheme(app, name);
    return { ok: true, message: `Installed and applied theme ${name}` };
  }
  return { ok: true, message: `Installed theme ${name}` };
}
