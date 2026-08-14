import fs from "node:fs";
import path from "node:path";

const clientDir = path.resolve("dist/client");
const assetsDir = path.join(clientDir, "assets");

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find((f) => f.endsWith(".css"));
  const jsIndexFile = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
  const jsRoutesFile = files.find((f) => f.startsWith("routes-") && f.endsWith(".js"));

  const cssTag = cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}">` : "";
  const jsIndexTag = jsIndexFile ? `<script type="module" src="/assets/${jsIndexFile}"></script>` : "";
  const jsRoutesTag = jsRoutesFile ? `<script type="module" src="/assets/${jsRoutesFile}"></script>` : "";

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JobPilot — AI Job Application Tracker</title>
    ${cssTag}
  </head>
  <body>
    <div id="root"></div>
    ${jsIndexTag}
    ${jsRoutesTag}
  </body>
</html>`;

  fs.writeFileSync(path.join(clientDir, "index.html"), htmlContent);
  console.log("✓ Generated dist/client/index.html for Vercel static deployment");
}
