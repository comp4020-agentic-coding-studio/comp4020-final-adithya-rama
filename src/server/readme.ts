import { readFileSync } from "node:fs";
import { marked } from "marked";

// README.md rendered in full on the server, so /readme/ needs no script.
// Relative image links like docs/x.png resolve to /readme/docs/x.png, which
// main.ts serves from the repo's docs/ directory.
export function renderReadme(path: string): string {
  const body = marked.parse(readFileSync(path, "utf8"), { async: false });
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>About Jet Skirmish</title>
<style>
:root { color-scheme: light dark; --bg: #f6f3ec; --fg: #1d1f21; --muted: #5d6166; --accent: #b5481f; --rule: #d8d2c4; }
@media (prefers-color-scheme: dark) { :root { --bg: #15181b; --fg: #e8e4da; --muted: #a3a7ab; --accent: #f08a5d; --rule: #30353a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.6 system-ui, sans-serif; }
main { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
nav a, a { color: var(--accent); }
h1, h2, h3 { line-height: 1.25; }
h2 { border-top: 1px solid var(--rule); padding-top: 1.25rem; margin-top: 2rem; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--rule); padding: .35rem .6rem; text-align: left; }
code { font-size: .92em; }
pre { overflow-x: auto; padding: .75rem; border: 1px solid var(--rule); }
</style>
</head>
<body>
<main>
<nav><a href="/">← Play Jet Skirmish</a></nav>
${body}
</main>
</body>
</html>`;
}
