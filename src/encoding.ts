import { PackPayloadV1, PackPlugin, PluginTuple, StarterPack } from "./types";

/** Prefix for the paste-able code form ("Obsidian Starter Pack v1"). */
export const CODE_PREFIX = "OSP1:";
export const PROTOCOL_ACTION = "starter-packs";

// -- base64url helpers (unicode-safe) ---------------------------------------

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// -- encode ------------------------------------------------------------------

export function packToPayload(pack: StarterPack): PackPayloadV1 {
  const payload: PackPayloadV1 = {
    v: 1,
    n: pack.name,
    a: pack.author,
    p: pack.plugins.map((p) => pluginToTuple(p)),
  };
  if (pack.description) payload.d = pack.description;
  // Only emit `t` when there are themes, so plugin-only packs stay byte-identical
  // to the pre-theme format (shorter links, no needless churn).
  if (pack.themes.length) payload.t = pack.themes.map((t) => [t.name, t.author]);
  return payload;
}

/** [id, name, author, comment?, description?, enabled?] with trailing defaults
 * trimmed — a plain enabled plugin with no notes stays a 3-element tuple, so
 * simple packs are byte-identical to the pre-comment format. */
function pluginToTuple(p: PackPlugin): PluginTuple {
  const enabledFlag: 0 | 1 = p.enabled === false ? 0 : 1; // default true
  const full: [string, string, string, string, string, 0 | 1] = [
    p.id,
    p.name,
    p.author,
    p.comment ?? "",
    p.description ?? "",
    enabledFlag,
  ];
  // Drop trailing elements equal to their default (enabled=1, comment/desc="").
  let end = 6;
  if (full[5] === 1) {
    end = 5;
    if (full[4] === "") {
      end = 4;
      if (full[3] === "") end = 3;
    }
  }
  return full.slice(0, end) as PluginTuple;
}

export function encodePack(pack: StarterPack): string {
  return toBase64Url(JSON.stringify(packToPayload(pack)));
}

export function packToCode(pack: StarterPack): string {
  return CODE_PREFIX + encodePack(pack);
}

export function packToLink(pack: StarterPack): string {
  return `obsidian://${PROTOCOL_ACTION}?d=${encodePack(pack)}`;
}

// -- decode ------------------------------------------------------------------

/** Accepts any of: an obsidian:// link, an OSP1: code, or bare base64url —
 * with surrounding whitespace/newlines tolerated. Throws with a readable
 * message on anything unparseable. */
export function decodePackInput(raw: string): StarterPack {
  let s = raw.trim();
  if (!s) throw new Error("Nothing to import — paste a link or code first.");

  // Full link form (also tolerate a URL-encoded payload).
  const linkMatch = s.match(/obsidian:\/\/[^?\s]+\?([^\s]+)/);
  if (linkMatch) {
    const params = new URLSearchParams(linkMatch[1]);
    const d = params.get("d");
    if (!d) throw new Error("That link has no pack data (missing d= parameter).");
    s = d;
  }

  if (s.startsWith(CODE_PREFIX)) s = s.slice(CODE_PREFIX.length);
  // The payload is pure base64url; strip anything else that rode along with
  // the paste — line wraps, a markdown link's closing paren, trailing
  // punctuation from a chat message.
  s = s.replace(/[^A-Za-z0-9_-]+/g, "");

  return payloadToPack(parsePayload(s));
}

export function parsePayload(base64url: string): PackPayloadV1 {
  let obj: unknown;
  try {
    obj = JSON.parse(fromBase64Url(base64url));
  } catch {
    throw new Error("Couldn't decode that — it doesn't look like a starter pack link or code.");
  }
  const p = obj as Partial<PackPayloadV1>;
  if (!p || typeof p !== "object" || p.v !== 1) {
    throw new Error(
      "Unsupported pack format" +
        (p && typeof p === "object" && "v" in p ? ` (version ${(p as { v: unknown }).v})` : "") +
        " — this plugin may need an update."
    );
  }
  if (typeof p.n !== "string" || !Array.isArray(p.p)) {
    throw new Error("That pack is malformed (missing name or plugin list).");
  }
  return p as PackPayloadV1;
}

export function payloadToPack(payload: PackPayloadV1): StarterPack {
  const now = new Date().toISOString();
  // Caps keep a hostile/garbled payload from flooding the UI or data.json.
  const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
  const plugins: PackPlugin[] = payload.p
    .slice(0, 500)
    .filter((e) => Array.isArray(e) && typeof e[0] === "string" && e[0].length > 0)
    .map((entry) => {
      // Loose view so we can read the optional trailing positions regardless of
      // this tuple's actual length.
      const e = entry as ReadonlyArray<string | number | undefined>;
      const plugin: PackPlugin = {
        id: cap(String(e[0]), 200),
        name: cap(typeof e[1] === "string" && e[1] ? e[1] : String(e[0]), 200),
        author: cap(typeof e[2] === "string" ? e[2] : "", 200),
      };
      if (typeof e[3] === "string" && e[3]) plugin.comment = cap(e[3], 500);
      if (typeof e[4] === "string" && e[4]) plugin.description = cap(e[4], 2000);
      if (e[5] === 0) plugin.enabled = false; // absent / 1 => enabled (default)
      return plugin;
    });
  const themes = (Array.isArray(payload.t) ? payload.t : [])
    .slice(0, 100)
    .filter((e) => Array.isArray(e) && typeof e[0] === "string" && e[0].length > 0)
    .map((e) => ({
      name: cap(String(e[0]), 200),
      author: cap(typeof e[1] === "string" ? e[1] : "", 200),
    }));
  return {
    id: randomId(),
    name: cap(payload.n || "Untitled pack", 200),
    author: cap(typeof payload.a === "string" ? payload.a : "", 200),
    description: cap(typeof payload.d === "string" ? payload.d : "", 2000),
    plugins,
    themes,
    createdAt: now,
    updatedAt: now,
  };
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export interface MarkdownOptions {
  /** Render each plugin name as a `###` heading instead of a bullet. */
  headings?: boolean;
  /** Include the author's per-plugin comment + description. */
  descriptions?: boolean;
}

/** A human-readable markdown rendering of a pack, for forum/gist sharing. */
export function packToMarkdown(pack: StarterPack, opts: MarkdownOptions = {}): string {
  const headings = opts.headings ?? true;
  const descriptions = opts.descriptions ?? true;
  const lines: string[] = [];
  lines.push(`## ${pack.name}`);
  const by = pack.author ? ` by ${pack.author}` : "";
  const themeCount = pack.themes.length;
  const themeBit = themeCount ? ` and ${themeCount} theme${themeCount === 1 ? "" : "s"}` : "";
  lines.push(
    `A starter pack of ${pack.plugins.length} Obsidian plugin${pack.plugins.length === 1 ? "" : "s"}${themeBit}${by}.`
  );
  if (pack.description) lines.push("", pack.description);
  lines.push("");
  if (pack.plugins.length) lines.push(headings ? "## Plugins" : "**Plugins**");
  for (const p of pack.plugins) {
    const link = `obsidian://show-plugin?id=${encodeURIComponent(p.id)}`;
    const author = p.author ? ` — ${p.author}` : "";
    const disabledNote = p.enabled === false ? " _(the author keeps this off)_" : "";
    if (headings) {
      lines.push(`### [${p.name}](${link})${author}${disabledNote}`);
      if (descriptions) {
        if (p.comment) lines.push(`> ${p.comment}`);
        if (p.description) lines.push(p.description);
      }
      lines.push("");
    } else {
      lines.push(`- [${p.name}](${link})${author}${disabledNote}`);
      if (descriptions) {
        if (p.comment) lines.push(`  - _${p.comment}_`);
        if (p.description) lines.push(`  - ${p.description}`);
      }
    }
  }
  if (themeCount) {
    lines.push("", "**Themes**");
    for (const t of pack.themes) {
      const author = t.author ? ` — ${t.author}` : "";
      lines.push(`- ${t.name}${author}`);
    }
  }
  lines.push("");
  lines.push(`**One-click import** (needs the Starter Packs plugin): [open pack](${packToLink(pack)})`);
  lines.push("");
  lines.push("Or paste this code into Starter Packs → Import:");
  lines.push("");
  lines.push("```");
  lines.push(packToCode(pack));
  lines.push("```");
  return lines.join("\n");
}
