// Every Voices Across History collection, so a roundtable can seat figures from any of them.
// scripts/sync-shared.sh copies this file into each app's catalog/ folder, alongside a copy of
// every collection's figures.js (as <collection>.js). Edit figures in each collection's own
// figures.js, then re-run the script so every app's catalog stays current.
import * as republic from "./republic.js";
import * as philosophers from "./philosophers.js";
import * as inventors from "./inventors.js";
import * as explorers from "./explorers.js";
import * as women from "./women.js";

export const CATALOG = [republic, philosophers, inventors, explorers, women].map((m) => ({ collection: m.COLLECTION, figures: m.FIGURES }));

// One entry per person: figures who appear in two collections (Ada Lovelace, Marie Curie…) are
// listed once, under the first collection they appear in. Each entry notes its home collection.
export const ALL_FIGURES = (() => {
  const seen = new Set();
  const out = [];
  for (const { collection, figures } of CATALOG) {
    for (const f of figures) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({ ...f, home: collection.id, homeName: collection.name });
    }
  }
  return out;
})();
