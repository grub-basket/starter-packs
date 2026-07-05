import { App, Notice, PluginManifest, requestUrl } from "obsidian";

/** One entry from the official community-plugins.json registry. */
export interface CatalogEntry {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
}

const CATALOG_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json";

/** In-memory cache — the catalog is ~MB scale, so it's fetched at most once
 * per session (per successful fetch) and never persisted. */
let catalogCache: Map<string, CatalogEntry> | null = null;
let catalogFetchedAt = 0;
const CATALOG_TTL_MS = 30 * 60 * 1000;

export async function fetchCatalog(): Promise<Map<string, CatalogEntry>> {
  const fresh = catalogCache && Date.now() - catalogFetchedAt < CATALOG_TTL_MS;
  if (catalogCache && fresh) return catalogCache;
  try {
    const res = await requestUrl({ url: CATALOG_URL });
    const list = res.json as CatalogEntry[];
    if (!Array.isArray(list)) throw new Error("Unexpected community catalog format");
    const map = new Map<string, CatalogEntry>();
    for (const e of list) if (e && e.id) map.set(e.id, e);
    catalogCache = map;
    catalogFetchedAt = Date.now();
    return map;
  } catch (e) {
    // A stale catalog beats no catalog — only throw when we have nothing.
    if (catalogCache) return catalogCache;
    throw new Error("Couldn't load the community plugin catalog (offline or GitHub unavailable).");
  }
}

export type PluginStatus = "enabled" | "disabled" | "not-installed";

export function pluginStatus(app: App, id: string): PluginStatus {
  const plugins = (app as unknown as { plugins: ObsidianPluginsApi }).plugins;
  if (!plugins.manifests[id]) return "not-installed";
  return plugins.enabledPlugins.has(id) ? "enabled" : "disabled";
}

/** The undocumented parts of app.plugins we rely on. Feature-detected at the
 * call sites — Obsidian can change these between releases. */
interface ObsidianPluginsApi {
  manifests: Record<string, PluginManifest>;
  enabledPlugins: Set<string>;
  installPlugin?: (repo: string, version: string, manifest: PluginManifest) => Promise<void>;
  loadManifests?: () => Promise<void>;
  enablePluginAndSave?: (id: string) => Promise<void>;
  disablePluginAndSave?: (id: string) => Promise<void>;
}

function pluginsApi(app: App): ObsidianPluginsApi {
  return (app as unknown as { plugins: ObsidianPluginsApi }).plugins;
}

export function canDirectInstall(app: App): boolean {
  return typeof pluginsApi(app).installPlugin === "function";
}

/** Open Obsidian's own community-browser page for a plugin — the official,
 * always-works fallback for installing. */
export function openPluginPage(id: string): void {
  window.open(`obsidian://show-plugin?id=${encodeURIComponent(id)}`);
}

export interface InstallResult {
  ok: boolean;
  message: string;
}

/** Direct install via Obsidian's internal installer, mirroring what the
 * community browser does: resolve the repo from the catalog, find the latest
 * release, pull its manifest.json, then hand off to app.plugins.installPlugin.
 * Throws with a readable message on any failure. */
export async function installPluginDirect(
  app: App,
  id: string,
  opts: { enable: boolean }
): Promise<InstallResult> {
  const api = pluginsApi(app);
  if (typeof api.installPlugin !== "function") {
    throw new Error("Direct install isn't available in this Obsidian version.");
  }
  const catalog = await fetchCatalog();
  const entry = catalog.get(id);
  if (!entry) throw new Error(`"${id}" isn't in the community catalog.`);

  let tag: string | undefined;
  try {
    const release = await requestUrl({
      url: `https://api.github.com/repos/${entry.repo}/releases/latest`,
      headers: { Accept: "application/vnd.github+json" },
    });
    tag = release.json?.tag_name;
  } catch {
    throw new Error(
      `Couldn't reach GitHub for ${entry.repo} (offline, or the API rate limit is exhausted — it resets within an hour).`
    );
  }
  if (!tag) throw new Error(`No release found for ${entry.repo}.`);

  let manifest: PluginManifest;
  try {
    const manifestRes = await requestUrl({
      url: `https://github.com/${entry.repo}/releases/download/${tag}/manifest.json`,
    });
    manifest = manifestRes.json as PluginManifest;
  } catch {
    throw new Error(`The ${tag} release of ${entry.repo} has no downloadable manifest.json.`);
  }
  if (!manifest || manifest.id !== id) {
    throw new Error(`Release manifest for ${entry.repo} doesn't match plugin id "${id}".`);
  }

  await api.installPlugin(entry.repo, tag, manifest);
  // Refresh the manifest registry so status checks see the new plugin.
  if (typeof api.loadManifests === "function") await api.loadManifests();
  if (!pluginsApi(app).manifests[id]) {
    throw new Error(`Install of ${entry.name} didn't stick — try the community browser instead.`);
  }

  if (opts.enable && typeof api.enablePluginAndSave === "function") {
    await api.enablePluginAndSave(id);
    return { ok: true, message: `Installed and enabled ${entry.name} ${manifest.version}` };
  }
  return { ok: true, message: `Installed ${entry.name} ${manifest.version}` };
}

/** Best-effort enable for an installed-but-disabled plugin. */
export async function enablePlugin(app: App, id: string): Promise<boolean> {
  const api = pluginsApi(app);
  if (typeof api.enablePluginAndSave !== "function") return false;
  await api.enablePluginAndSave(id);
  return true;
}

/** Best-effort disable for an installed-and-enabled plugin. */
export async function disablePlugin(app: App, id: string): Promise<boolean> {
  const api = pluginsApi(app);
  if (typeof api.disablePluginAndSave !== "function") return false;
  await api.disablePluginAndSave(id);
  return true;
}

export async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    new Notice(`[Starter Packs] ${label} copied to clipboard`);
  } catch {
    new Notice(`[Starter Packs] Couldn't access the clipboard — ${label.toLowerCase()} shown below`, 8000);
  }
}
