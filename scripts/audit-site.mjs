import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const origin = "https://vocalisto.app";
const failures = [];
const htmlFiles = [];

async function walk(directory) {
  for (const name of await readdir(directory)) {
    if (name === ".git" || name === "node_modules") continue;
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else if (name.endsWith(".html")) htmlFiles.push(path);
  }
}

const count = (text, pattern) => [...text.matchAll(pattern)].length;
const fail = (file, message) => failures.push(`${relative(root, file)}: ${message}`);
const routeFor = (file) => {
  const name = relative(root, file).replaceAll("\\", "/");
  if (name === "index.html") return "/";
  if (name.endsWith("/index.html")) return `/${dirname(name)}/`;
  return `/${name}`;
};
const fileForUrl = (url, currentFile) => {
  const value = url.split("#")[0].split("?")[0];
  if (!value || /^(mailto:|tel:|https?:)/.test(value)) return null;
  const route = value.startsWith("/") ? value : `/${relative(root, resolve(dirname(currentFile), value)).replaceAll("\\", "/")}`;
  if (route === "/") return join(root, "index.html");
  if (route.endsWith("/")) return join(root, route, "index.html");
  return join(root, route);
};

await walk(root);
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const route = routeFor(file);
  if (!/^<!doctype html>/i.test(html)) fail(file, "missing HTML doctype");
  if (!/<html\s+lang="en"/i.test(html)) fail(file, "missing English language declaration");
  if (count(html, /<title\b/gi) !== 1) fail(file, "must contain exactly one title");
  if (count(html, /<h1\b/gi) !== 1) fail(file, "must contain exactly one h1");
  if (!/<meta\s+name="viewport"/i.test(html)) fail(file, "missing viewport metadata");
  if (!/<link\s+rel="icon"\s+href="\/favicon\.svg"/i.test(html)) fail(file, "missing Vocalisto favicon");
  if (!/<main\b[^>]*id="main-content"/i.test(html)) fail(file, "missing #main-content landmark");
  if (!/<a\s+class="skip-link"\s+href="#main-content"/i.test(html)) fail(file, "missing skip link");
  if (/\b(Listo|small mouse|mouse who)\b/i.test(html)) fail(file, "contains retired mouse-era language");

  if (route !== "/404.html") {
    const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
    if (!description) fail(file, "missing meta description");
    else if (route !== "/terms.html" && (description.length < 110 || description.length > 165)) fail(file, `meta description length ${description.length} is outside 110–165 characters`);
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
    const expected = `${origin}${route}`;
    if (canonical !== expected) fail(file, `canonical must be ${expected}`);
  }

  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    const target = fileForUrl(match[1], file);
    if (!target) continue;
    try { await stat(target); } catch { fail(file, `broken internal link ${match[1]}`); }
  }
}

const homepage = await readFile(join(root, "index.html"), "utf8");
for (const required of ["og:image", "twitter:card", "application/ld+json", "site.webmanifest"]) {
  if (!homepage.includes(required)) failures.push(`index.html: missing ${required}`);
}

const robots = await readFile(join(root, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) failures.push("robots.txt: missing canonical sitemap URL");
const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
for (const file of htmlFiles) {
  const route = routeFor(file);
  if (route === "/404.html" || route === "/terms.html") continue;
  if (!sitemap.includes(`<loc>${origin}${route}</loc>`)) failures.push(`sitemap.xml: missing ${route}`);
}
for (const required of ["/privacy.html", "/terms.html", "/support.html"]) {
  for (const file of htmlFiles.filter((path) => !path.endsWith("404.html"))) {
    const html = await readFile(file, "utf8");
    if (!html.includes(`href="${required}"`)) fail(file, `footer or page chrome must link to ${required}`);
  }
}

if (failures.length) {
  console.error(`Vocalisto site audit failed (${failures.length}):\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}
console.log(`Vocalisto site audit passed: ${htmlFiles.length} HTML pages, internal links, metadata, legal navigation, robots and sitemap.`);
