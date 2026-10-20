/* Build script. index.html is the source of truth and is already a complete
   page for GitHub Pages (it loads src/model.js and src/scoring.js relatively).
   This script derives two variants from it:

   dist/meterian-readiness-check.html   one self-contained file (model and
                                        scoring inlined) for WordPress or
                                        HubSpot embedding
   artifact/index.html                  the same, with the document skeleton
                                        removed, for the Claude artifact preview

   Run: node build.js */
const fs = require("fs");
const path = require("path");

const page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const model = fs.readFileSync(path.join(__dirname, "src/model.js"), "utf8");
const scoring = fs.readFileSync(path.join(__dirname, "src/scoring.js"), "utf8");

const inlined = page
  .replace('<script src="src/model.js"></script>', "<script>\n" + model + "\n</script>")
  .replace('<script src="src/scoring.js"></script>', "<script>\n" + scoring + "\n</script>");

fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "artifact"), { recursive: true });

const distPath = path.join(__dirname, "dist/meterian-readiness-check.html");
fs.writeFileSync(distPath, inlined);
console.log("Wrote", path.relative(__dirname, distPath), (inlined.length / 1024).toFixed(0) + " KB");

// Artifact variant: strip doctype/html/head/body wrappers and the metas the
// artifact host supplies itself; keep title, description, fonts, style, body.
const artifact = inlined
  .replace(/^<!doctype html>\s*/i, "")
  .replace(/<html[^>]*>\s*/i, "")
  .replace(/<\/html>\s*$/i, "")
  .replace(/<head>\s*/i, "")
  .replace(/<\/head>\s*/i, "")
  .replace(/<body>\s*/i, "")
  .replace(/<\/body>\s*/i, "")
  .replace(/<meta charset="utf-8">\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "")
  .replace("<title>", '<meta name="claude:viewport-fit-sides" content="cover">\n<title>');
const artPath = path.join(__dirname, "artifact/index.html");
fs.writeFileSync(artPath, artifact);
console.log("Wrote", path.relative(__dirname, artPath), (artifact.length / 1024).toFixed(0) + " KB");
