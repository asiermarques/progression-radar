#!/usr/bin/env node
// Proves that the radar works installed as a dependency: packs it, installs the tarball in a fixture Adopter
// repository (a package.json, a minimal config/ and a snapshot) with the package manager asked for, and runs the commands.
//
//   node scripts/adopter-fixture.mjs npm|pnpm|yarn-pnp|yarn-node-modules
//
// It fails when a command fails, when dist/ is not in the fixture, when the Report is not in the fixture's reports/, when
// the dev server does not reload on a change to config/ or serves snapshots/ or reports/, or when anything is written
// inside the installed radar. Used by CI (docs/ARCHITECTURE.md, "Testing").
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

try {
  step("pack the radar");
  const tarball = join(work, JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", work], { cwd: radar }))[0].filename);

  const scripts = Object.fromEntries(
    [["dev"], ["build"], ["preview"], ["check"], ["snapshot:record", "snapshot record"], ["snapshot:link", "snapshot link"], ["snapshot:check", "snapshot check"], ["snapshot:report", "snapshot report"], ["config:convert-categories", "config convert-categories"]].map(
      ([name, command = name]) => [name, `progression-radar ${command}`],
    ),
  );
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "ladder", private: true, version: "0.0.0", scripts }, null, 2));
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

  step("dev server reloads on config/ changes and does not serve snapshots/ or reports/");
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
    const socket = new WebSocket(`ws://localhost:${port}/`, "vite-hmr");
    let reloads = 0;
    socket.onmessage = (event) => {
      if (JSON.parse(event.data).type === "full-reload") reloads++;
    };
    await new Promise((resolve) => (socket.onopen = resolve));
    mkdirSync(join(fixture, "config", "categories"));
    cpSync(join(radar, "config.example", "categories", "01-build.md"), join(fixture, "config", "categories", "01-build.md"));
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
