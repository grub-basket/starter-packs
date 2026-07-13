# Starter Packs

Share your favorite Obsidian plugins **and themes** as a **starter pack** — a named, curated list you can send to anyone as a link or a short code, the way Bluesky starter packs or mod packs work.

## Sharing

1. Open **Starter packs** (ribbon icon or command palette).
2. **New pack** — name it, put your name on it, and tick the plugins (and community themes) from your vault you want to include. A pack can be plugins, themes, or both.
   - **Annotate each plugin** (optional): add a short **comment** and a **description**, and set an **enable flag** — it defaults to whether *you* have the plugin enabled and you can override it per plugin. The comment/description show on import and in the exported markdown; the enable flag is informational (see Receiving).
3. **Share** — copy any of:
   - **Link** — `obsidian://starter-packs?d=…` — opens straight into an import preview for anyone with this plugin installed.
   - **Code** — `OSP1:…` — paste-able anywhere, survives forums that mangle links.
   - **Markdown** — a readable list (every plugin linked to its community page) with the link and code included, ready for a forum post or note. Toggle **plugin names as headings** and **include comments & descriptions** to control how rich it is.

You can also **Export as note** — write the pack into your vault as a readable note (every plugin linked, with the import link and code embedded), handy for keeping a copy or posting it somewhere.

Packs are self-contained: the link/code carries the pack name, your name, and each plugin's name and author, so recipients see a full preview even before installing anything.

## Receiving

- Click a starter-pack link (Obsidian opens the preview), or run **Import a starter pack** and paste a link or code.
- The preview shows what's in the pack and what you already have, split into **Plugins** and **Themes**. Install items one at a time, or **Install all missing** — plugins and themes install one after another (spaced out to stay friendly with GitHub's rate limits), with a progress bar in the modal and a notification that keeps counting even if you close the window, so you know exactly when everything is ready.
- For themes, each row also offers **Apply** once it's installed (Obsidian uses one active theme at a time).
- Each plugin shows the author's optional **comment and description**, and an **"author: off"** marker if the author keeps it disabled — the enable flag is *informational only*, it never auto-enables anything on your side.
- **Plugins are installed *disabled* by default**, so nothing runs until you say so. Review the pack, then use **Enable all** (or the per-plugin Enable) to turn them on — and **Disable all** to turn them back off. You can flip the default to auto-enable in settings if you only ever import packs you fully trust.
- Imported packs are kept under **Shared with me** so you can come back to them later, or **Save as mine** to edit and re-share.

Only import packs from people you trust — community plugins run with full access to your vault. Direct install can be turned off in settings, in which case installs go through Obsidian's own community-browser pages.

## Notes

- Archiving a pack never breaks links you've already shared — they carry their own copy of the list.
- Plugins and themes not in their community catalog (e.g. beta plugins) are shown and flagged, but can't be auto-installed.
- **CSS snippets** aren't included in packs: unlike plugins and themes they have no community store to install from, so there's nothing to link to. They're on the roadmap for a future vault-replication feature that would bundle files directly.
- **Mobile:** the plugin is built to work on mobile, but that path isn't tested and has no dedicated QA yet — treat mobile as best-effort for now.

### A note on author names

Author names on a pack are **informational, not verified** — there's no identity system, so anyone can put any name on a pack. We chose to keep this simple rather than build a contributor/provenance system.

When you use **Save as mine** on a pack someone shared, it keeps the **original** author's name until you edit and save the pack — at which point it becomes yours. This is a deliberate trade-off: it preserves attribution by default, but it also means a pack you modify and re-share still carries the original author's name until you make it your own. There's no enforcement in either direction; it's on the good faith of whoever's sharing.

## Limitations & security

Starter Packs shares a **list of plugins and themes** — nothing else travels with a pack:

- **No plugin settings.** Recipients get a fresh install with defaults (each plugin's `data.json` is not shared).
- **No CSS snippets.** They have no community store to install from.
- **No hotkeys, appearance/theme config, or other `.obsidian` contents.**
- **Not-in-catalog items** (beta/BRAT plugins, private themes) are shown but flagged as not auto-installable.

**Security:** community plugins run with full access to your vault, so only import packs from people you trust. Installed plugins are **disabled by default** — review, then *Enable all*. A pack itself can't run code; the risk is in the plugins it points to.

**Want to replicate a whole vault** (settings, snippets, hotkeys)? Starter Packs deliberately doesn't — bundling settings can leak secrets (API keys/tokens in plugin `data.json`) and machine-specific paths, so the reliable route is to **zip your `.obsidian` folder yourself**. The plugin gives you a ready-made, offline **replication checklist** (Settings → *Save as note*, or the "Create a vault replication checklist note" command) that walks through it safely, including how to strip secrets first. (A dedicated vault-replication plugin may cover this end-to-end later; it's intentionally out of scope here.)

## Similar plugins

The "install a list of plugins" idea isn't new — a few plugins touch this space:

- **[Share my plugin list](https://github.com/Benature/obsidian-share-my-plugin-list)** (Benature) — exports your plugins as a markdown list or table with per-plugin one-click install and an "Install all" command. Shares as text you embed in a note.
- **[Plugin Groups](https://github.com/Mocca101/obsidian-plugin-groups)** (Mocca101) — organizes *already-installed* plugins into groups for bulk enable/disable and staggered startup. Not a sharing tool.
- **Extension Hub** — a browser for finding and installing plugins across multiple vaults.

**Where Starter Packs is different:** it's built around *curated, named, authored* collections — the "Bluesky starter pack" framing — shared as a link or code that opens an **in-app preview** before anything installs:

| Starter Packs | Share my plugin list |
|---|---|
| **Multiple curated, named packs** (pick specific plugins) | Dumps your *whole* current plugin list |
| **Your name on each pack** | No per-pack authorship |
| **Share as a link or code** (`obsidian://…` / `OSP1:…`) that opens **in-app** | Markdown text you embed in a note |
| **Preview screen** before installing | No preview |

The full positioning write-up is in [PITCH.md](PITCH.md).
