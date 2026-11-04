#!/usr/bin/env node
/**
 * Audits licences of every package reachable from production dependencies.
 * Fails (exit 1) on copyleft or unknown licences unless explicitly allow-listed.
 *
 * Usage: npm run licenses:check   (add --list to print every package)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const BLOCKED = /\b(A?GPL|LGPL|SSPL|EUPL|MPL|CDDL|CPAL|OSL|RPL|Commons-Clause|BUSL|Elastic)\b/i;
const PERMISSIVE = /^(\(?(MIT|ISC|BSD-2-Clause|BSD-3-Clause|0BSD|Apache-2\.0|CC0-1\.0|CC-BY-4\.0|Unlicense|BlueOak-1\.0\.0|Python-2\.0|Zlib|WTFPL)\)?( (OR|AND) )?)+$/i;
// Reviewed exceptions: package name → reason.
// These are build tooling pulled in by the `expo` package (CLI / Metro CSS) and
// are not bundled into the shipped app.
const ALLOW = {
  '@expo-google-fonts/inter': 'MIT (loader code) AND OFL-1.1 (Inter font files). OFL is a permissive font licence: free to bundle and ship in apps.',
  'node-forge': 'Dual-licensed; used under BSD-3-Clause. Expo CLI dev-server tooling only.',
  lightningcss: 'MPL-2.0 (file-level copyleft). Build-time CSS transformer used by Metro; not shipped.',
  'lightningcss-linux-x64-gnu': 'Native binary of lightningcss; build-time only.',
  'lightningcss-linux-x64-musl': 'Native binary of lightningcss; build-time only.',
  'lightningcss-darwin-arm64': 'Native binary of lightningcss; build-time only.',
  'lightningcss-darwin-x64': 'Native binary of lightningcss; build-time only.',
  'lightningcss-win32-x64-msvc': 'Native binary of lightningcss; build-time only.',
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function resolvePackage(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type || l).join(' OR ');
  return 'UNKNOWN';
}

const rootPkg = readJson(path.join(root, 'package.json'));
const seen = new Map();
const queue = Object.keys(rootPkg.dependencies || {}).map((name) => [name, root]);
while (queue.length) {
  const [name, from] = queue.shift();
  const file = resolvePackage(name, from);
  if (!file || seen.has(file)) continue;
  const pkg = readJson(file);
  if (!pkg) continue;
  seen.set(file, { name: pkg.name, version: pkg.version, license: licenseOf(pkg) });
  const dir = path.dirname(file);
  for (const dep of Object.keys({ ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) })) queue.push([dep, dir]);
}

const problems = [];
const byLicense = {};
for (const { name, version, license } of seen.values()) {
  byLicense[license] = (byLicense[license] || 0) + 1;
  if (ALLOW[name]) continue;
  if (BLOCKED.test(license) || !PERMISSIVE.test(license.trim())) problems.push(`${name}@${version}: ${license}`);
}

if (process.argv.includes('--list')) {
  for (const { name, version, license } of [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))) console.log(`${name}@${version}\t${license}`);
}
console.log(`Checked ${seen.size} production packages.`);
console.log(Object.entries(byLicense).sort((a, b) => b[1] - a[1]).map(([l, n]) => `  ${l}: ${n}`).join('\n'));
if (problems.length) {
  console.error(`\nLicences needing review (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nNo copyleft or unknown licences found.');
