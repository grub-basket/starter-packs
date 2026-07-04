// Copies the built plugin artifacts into one or more vault plugin folders.
// Target resolution: STARTER_PACKS_DEPLOY env var (single path), else the
// `.deploy-targets` file (gitignored) at the project root — one absolute
// path per line, `#` comments allowed. Every target must be a plugin folder.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = ["main.js", "manifest.json", "styles.css"]; // styles.css optional

function resolveTargets() {
  if (process.env.STARTER_PACKS_DEPLOY) return [process.env.STARTER_PACKS_DEPLOY.trim()];
  const f = path.join(ROOT, ".deploy-targets");
  if (fs.existsSync(f)) {
    return fs
      .readFileSync(f, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }
  return [];
}

const targets = resolveTargets();
if (!targets.length) {
  console.error(
    "No deploy targets. Set STARTER_PACKS_DEPLOY or create a .deploy-targets file\n" +
      "with one absolute path per line, each pointing at\n" +
      "<vault>/.obsidian/plugins/starter-packs"
  );
  process.exit(1);
}

for (const target of targets) {
  // Sanity check: refuse to write somewhere that isn't a plugin folder.
  if (!target.includes(`${path.sep}plugins${path.sep}`) && !target.includes("/plugins/")) {
    console.error(`Refusing to deploy: "${target}" doesn't look like a plugins folder.`);
    process.exit(1);
  }
  fs.mkdirSync(target, { recursive: true });
  let copied = 0;
  for (const a of ARTIFACTS) {
    const src = path.join(ROOT, a);
    if (!fs.existsSync(src)) {
      if (a === "styles.css") continue; // optional
      console.error(`Missing artifact: ${a} (run the build first)`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(target, a));
    copied++;
  }
  console.log(`Deployed ${copied} artifact(s) to ${target}`);
}
