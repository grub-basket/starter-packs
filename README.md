# Starter Packs

Share your favorite Obsidian plugins as a **starter pack** — a named, curated list you can send to anyone as a link or a short code, the way Bluesky starter packs or mod packs work.

## Sharing

1. Open **Starter packs** (ribbon icon or command palette).
2. **New pack** — name it, put your name on it, and tick the plugins from your vault you want to include.
3. **Share** — copy any of:
   - **Link** — `obsidian://starter-packs?d=…` — opens straight into an import preview for anyone with this plugin installed.
   - **Code** — `OSP1:…` — paste-able anywhere, survives forums that mangle links.
   - **Markdown** — a readable list (every plugin linked to its community page) with the link and code included, ready for a forum post or note.

Packs are self-contained: the link/code carries the pack name, your name, and each plugin's name and author, so recipients see a full preview even before installing anything.

## Receiving

- Click a starter-pack link (Obsidian opens the preview), or run **Import a starter pack** and paste a link or code.
- The preview shows what's in the pack and what you already have. Install plugins one at a time, or **Install all missing** — plugins download from their official GitHub releases and can be enabled automatically.
- Imported packs are kept under **Shared with me** so you can come back to them later, or **Save as mine** to edit and re-share.

Only import packs from people you trust — community plugins run with full access to your vault. Direct install can be turned off in settings, in which case installs go through Obsidian's own community-browser pages.

## Notes

- Archiving a pack never breaks links you've already shared — they carry their own copy of the list.
- Plugins not in the community catalog (e.g. beta plugins) are shown and flagged, but can't be auto-installed.

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
