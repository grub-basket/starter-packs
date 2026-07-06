# Starter Packs — the pitch

## One line

**Share a curated, named, authored set of Obsidian plugins as a link or short code that opens an in-app preview — the way Bluesky starter packs let you share a set of accounts to follow.**

## The problem

Getting someone set up with "the plugins I use" is clumsy today. You either:

- type out a list of plugin names and make them search each one by hand, or
- send a wall of install links, or
- share your whole vault (heavy, and it drags along your notes and secrets).

And when *you* run 40 plugins, "here's my list" is rarely what you mean — you mean *"here's the handful you need for academic writing,"* or *"here's my starter set for a brand-new vault."* There's no clean way to hand someone a **curated, named** bundle and have them get it in a couple of clicks.

## The idea

Borrow the pattern that already works on social platforms — Bluesky starter packs, X's follow-lists, game mod packs:

1. **Curate.** Pick specific plugins from your vault (not a dump of everything). Name the pack. Put your name on it. Add a description.
2. **Share.** One click gives you a link (`obsidian://starter-packs?d=…`), a paste-able code (`OSP1:…`), or a ready-made markdown block for a forum post. The pack is *self-contained* — the payload carries the pack name, your name, and every plugin's name + author, so there's no server and nothing to expire.
3. **Receive.** The link opens an **in-app preview** right inside Obsidian: what's in the pack, who made it, and what you already have vs. what's missing. Install one at a time or "Install all missing" — plugins come from their official GitHub releases.

## Why it's not just "install a list"

The primitive of "install several plugins at once" is genuinely solved (see Similar plugins in the README). What's *not* solved is the **social, curated framing**:

| Starter Packs | Existing tools |
|---|---|
| Multiple **curated, named** packs | Dump of your whole current list |
| **Author name** on each pack | No authorship |
| Shared as a **link or code** → opens **in-app** | Markdown text pasted into a note |
| **Preview** before installing | No preview |
| Self-contained payload, no server, never expires | — |

The difference is *"here's a dump of everything I run"* vs. *"here's my **Academic Writing** pack, curated by me — click to preview."* That second thing is the product.

## Who it's for

- **Creators / YouTubers / course authors** who recommend a setup and want a one-click way to hand it over.
- **Teams / onboarding** — "install the team's base pack" instead of a setup doc.
- **Anyone helping a friend** get started, or replicating a focused workflow (writing, PKM, dev) without cloning a whole vault.

## What it deliberately isn't

- **Not a full vault-replication tool** (settings, snippets, hotkeys, all of `.obsidian`). That's a separate concern — bundling settings ships secrets and machine-specific paths, so it belongs in its own plugin with a proper review/redaction flow. Starter Packs instead ships a **DIY replication checklist** (copy or save-as-note) that walks users through zipping `.obsidian` themselves and stripping secrets first. Themes are the exception that *does* belong here, because they install from a store just like plugins.
- **Not a directory / discovery feed** — it's peer-to-peer sharing, not a hosted catalog.

## Interop opportunity

Existing exports (e.g. Share my plugin list's markdown/table) could be *imported* into a pack. Absorbing those formats turns a competitor into an on-ramp rather than a rival.
