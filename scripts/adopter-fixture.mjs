#!/usr/bin/env node
// Proves that the radar works installed as a dependency: packs it, installs the tarball in a fixture Adopter
// repository (a package.json, a minimal config/ and a snapshot) with the package manager asked for, runs `init` as an
// adopter would, and runs the commands.
//
//   node scripts/adopter-fixture.mjs npm|pnpm|yarn-pnp|yarn-node-modules
//
// It fails when a command fails, when `init` does not add the scripts, the README.md and the skills, when dist/ is not
// in the fixture, when the Report is not in the fixture's reports/, when the dev server fails to serve a module or a
// font the page loads (requested as a browser does), does not reload on a change to config/ or serves snapshots/,
// reports/ or another file of the fixture, or when anything is written inside the installed radar. Used by CI
// (docs/ARCHITECTURE.md, "Testing").
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const manager = process.argv[2];
const MANAGERS = ["npm", "pnpm", "yarn-pnp", "yarn-node-modules"];
if (!MANAGERS.includes(manager)) {
  console.error(`Usage: node scripts/adopter-fixture.mjs ${MANAGERS.join("|")}`);
  process.exit(2);
}
const yarn = manager.startsWith("yarn");
const bin = yarn ? "yarn" : manager;

const radar = fileURLToPath(new URL("..", import.meta.url));
const work = mkdtempSync(join(tmpdir(), `radar-adopter-${manager}-`));
const fixture = join(work, "ladder");
mkdirSync(join(fixture, "config"), { recursive: true });
mkdirSync(join(fixture, "snapshots"));

const step = (message) => console.log(`\n==> ${message}`);
const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: fixture, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...options });
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
};

// What is inside a folder: every file with its size and modification time.
function listing(folder) {
  const found = [];
  const walk = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(`${full} ${statSync(full).size} ${statSync(full).mtimeMs}`);
    }
  };
  walk(folder);
  return found.sort();
}

/**
 * Requests the page and every module it imports, and every font or image those modules point to, with the headers a
 * browser sends (Vite answers a script request differently). Returns what failed, with its status.
 */
async function loadLikeABrowser(url) {
  const request = (path, destination) => fetch(url + path, { headers: { "Sec-Fetch-Dest": destination, Accept: destination === "document" ? "text/html" : "*/*" } });
  const failures = [];
  const page = await request("/", "document");
  if (!page.ok) return [`${page.status} /`];
  const html = await page.text();
  const queue = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => new URL(match[1], `${url}/`).pathname);
  const assets = new Set();
  const seen = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await request(path, "script");
    if (!response.ok) {
      failures.push(`${response.status} ${path}`);
      continue;
    }
    const code = await response.text();
    if (path.includes("/.vite/deps/")) continue; // a pre-bundled dependency: its chunks are imported the same way
    const imports = [...code.matchAll(/^\s*(?:import|export)\b[^"'`;]*?["']([^"']+)["']/gm), ...code.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)];
    for (const [, specifier] of imports) {
      if (specifier.startsWith("/") || specifier.startsWith(".")) queue.push(new URL(specifier, url + path).pathname + new URL(specifier, url + path).search);
    }
    for (const [, asset] of code.matchAll(/url\(\\?["']?(\/[^"')\\]+)/g)) assets.add(asset);
  }
  for (const asset of assets) {
    const response = await request(asset, /\.(woff2?|ttf|otf)(\?|$)/.test(asset) ? "font" : "image");
    if (!response.ok) failures.push(`${response.status} ${asset}`);
  }
  if (![...seen].some((path) => path.includes("/@vite/client")) || seen.size < 10) failures.push(`only ${seen.size} modules were found: ${[...seen].join(", ")}`);
  return failures;
}

try {
  step("pack the radar");
  const tarball = join(work, JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], { cwd: radar }))[0].filename);

  const scripts = Object.fromEntries(
    [["dev"], ["build"], ["preview"], ["check"], ["snapshot:record", "snapshot record"], ["snapshot:link", "snapshot link"], ["snapshot:check", "snapshot check"], ["snapshot:report", "snapshot report"], ["config:convert-categories", "config convert-categories"]].map(
      ([name, command = name]) => [name, `progression-radar ${command}`],
    ),
  );
  // No scripts: `init` adds them.
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "ladder", private: true, version: "0.0.0" }, null, 2));
  // A minimal Config folder: the other files come from the Sample configuration. "fixture-role" shows up in the build.
  writeFileSync(join(fixture, "config", "roles.yml"), "- key: fixture-role\n  name: Fixture role\n  levels: { build: 2 }\n");
  writeFileSync(join(fixture, "snapshots", "2026-11-07.csv"), "id,name,role,build\nana-garcia,Ana García,fixture-role,2\n");

  step(`install with ${manager}`);
  if (yarn) {
    run("yarn", ["set", "version", "stable"]);
    // `set version` writes .yarnrc.yml with the path of the release it downloaded: add to it.
    appendFileSync(join(fixture, ".yarnrc.yml"), `nodeLinker: ${manager === "yarn-pnp" ? "pnp" : "node-modules"}\nenableTelemetry: false\n`);
    run("yarn", ["add", `progression-radar@file:${tarball}`]);
  } else {
    run(manager, manager === "npm" ? ["install", tarball] : ["add", tarball]);
  }

  // Where the radar was installed, to prove that nothing is written there.
  const installed = [join(fixture, "node_modules", "progression-radar"), join(fixture, ".yarn", "unplugged")]
    .filter(existsSync)
    .map((path) => realpathSync(path));
  const before = installed.flatMap(listing);

  step("init");
  const exec = (...args) => run(bin, yarn ? args : manager === "npm" ? ["exec", "--", ...args] : ["exec", ...args]);
  exec("progression-radar", "init");
  const manifest = JSON.parse(readFileSync(join(fixture, "package.json"), "utf8"));
  if (JSON.stringify(manifest.scripts) !== JSON.stringify(scripts)) fail(`init did not add the scripts:\n${JSON.stringify(manifest.scripts, null, 2)}`);
  if (!readFileSync(join(fixture, "config", "roles.yml"), "utf8").includes("fixture-role")) fail("init overwrote config/roles.yml");
  if (!readFileSync(join(fixture, ".gitignore"), "utf8").split("\n").includes("reports/")) fail("init did not add reports/ to .gitignore");
  const { version } = JSON.parse(readFileSync(join(radar, "package.json"), "utf8"));
  const readme = readFileSync(join(fixture, "README.md"), "utf8");
  if (!readme.includes(`https://github.com/asiermarques/progression-radar/blob/v${version}/docs/guides/getting-started.md`)) {
    fail("the README.md that init writes does not link to the guides of the installed version");
  }
  const shippedSkills = readdirSync(join(radar, ".claude", "skills")).filter((name) => name.startsWith("progression-radar-"));
  for (const name of shippedSkills) {
    const copied = join(fixture, ".claude", "skills", name, "SKILL.md");
    if (!existsSync(copied) || readFileSync(copied, "utf8") !== readFileSync(join(radar, ".claude", "skills", name, "SKILL.md"), "utf8")) {
      fail(`init did not copy the skill ${name} to .claude/skills/`);
    }
  }
  if (!exec("progression-radar", "skills").includes("up to date")) fail("progression-radar skills does not see the copied skills as up to date");
  // The dev server test adds this Category file back.
  rmSync(join(fixture, "config", "categories", "10-people.md"));

  const script = (name, ...args) => run(bin, yarn ? [name, ...args] : ["run", name, ...(manager === "npm" && args.length ? ["--", ...args] : args)]);

  step("check");
  const checked = script("check");
  if (!checked.includes("The Configuration is valid.")) fail(`check did not report a valid Configuration:\n${checked}`);

  step("build");
  script("build");
  if (!existsSync(join(fixture, "dist", "index.html"))) fail("dist/index.html is not in the fixture");
  const bundle = readdirSync(join(fixture, "dist", "assets")).filter((name) => name.endsWith(".js"));
  if (!bundle.some((name) => readFileSync(join(fixture, "dist", "assets", name), "utf8").includes("Fixture role"))) {
    fail("the built site does not show the role of the fixture's config/roles.yml");
  }

  step("snapshot:link");
  const link = script("snapshot:link", "2026-11-07.csv", "ana-garcia").trim();
  if (!link.includes("name=Ana") || !link.includes("build=2")) fail(`unexpected Share link: ${link}`);

  step("snapshot:report");
  const reported = script("snapshot:report").trim().split("\n").at(-1);
  if (!/^reports\/\d{4}-\d{2}-\d{2}\.html$/.test(reported)) fail(`snapshot:report did not print the path of the Report: ${reported}`);
  const reportFile = join(fixture, reported);
  if (!existsSync(reportFile)) fail(`${reported} is not in the fixture`);
  const reportHtml = readFileSync(reportFile, "utf8");
  if (!reportHtml.includes("Ana García") || /<script/i.test(reportHtml) || !reportHtml.includes("default-src 'none'")) {
    fail("the Report does not have the Person of the snapshot, or has a script, or has no Content-Security-Policy");
  }

  step("dev server serves the page as a browser loads it, reloads on config/ changes and serves nothing else of the fixture");
  const port = 4300 + MANAGERS.indexOf(manager);
  const dev = spawn(bin, yarn ? ["dev", "--port", String(port)] : ["run", "dev", ...(manager === "npm" ? ["--"] : []), "--port", String(port)], { cwd: fixture, stdio: ["ignore", "inherit", "inherit"], detached: true });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const url = `http://localhost:${port}`;
    for (let attempt = 0; ; attempt++) {
      if (await fetch(url).then((response) => response.ok, () => false)) break;
      if (attempt > 60) fail("the dev server did not start");
      await wait(500);
    }
    const failures = await loadLikeABrowser(url);
    if (failures.length > 0) fail(`the dev server did not serve what the page loads, so it stays blank:\n${failures.join("\n")}`);
    for (const file of ["package.json", "README.md"]) {
      const response = await fetch(`${url}/@fs${join(realpathSync(fixture), file)}`, { headers: { "Sec-Fetch-Dest": "script" } });
      if (response.ok) fail(`the dev server served ${file} of the fixture`);
    }
    const socket = new WebSocket(`ws://localhost:${port}/`, "vite-hmr");
    let reloads = 0;
    socket.onmessage = (event) => {
      if (JSON.parse(event.data).type === "full-reload") reloads++;
    };
    await new Promise((resolve) => (socket.onopen = resolve));
    cpSync(join(radar, "config.example", "categories", "10-people.md"), join(fixture, "config", "categories", "10-people.md"));
    await wait(2000);
    if (reloads === 0) fail("the page did not reload when a Category file was added to config/categories/");
    writeFileSync(join(fixture, "config", "roles.yml"), "- key: fixture-role\n  name: Fixture role changed\n  levels: { build: 2 }\n");
    const reloadsBefore = reloads;
    await wait(2000);
    if (reloads === reloadsBefore) fail("the page did not reload when config/roles.yml was edited");
    for (const path of [`/@fs${join(fixture, "snapshots", "2026-11-07.csv")}`, "/snapshots/2026-11-07.csv"]) {
      const body = await fetch(url + path).then((response) => response.text());
      if (body.includes("ana-garcia")) fail(`the dev server served ${path}`);
    }
    for (const path of [`/@fs${reportFile}`, `/${reported}`]) {
      const body = await fetch(url + path).then((response) => response.text());
      if (body.includes("Ana García")) fail(`the dev server served ${path}`);
    }
    socket.close();
  } finally {
    process.kill(-dev.pid);
  }

  step("nothing was written inside the installed radar");
  const after = installed.flatMap(listing);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    fail(`files changed inside the installed radar:\n${after.filter((line) => !before.includes(line)).join("\n")}`);
  }
  console.log(`\nOK: ${manager}`);
} catch (error) {
  process.exitCode = 1;
  console.error(error instanceof Error ? error.message : error);
} finally {
  rmSync(work, { recursive: true, force: true });
}
