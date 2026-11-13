// Checks the licenses of all installed dependencies against license-check.json.
//
//   npm run check:licenses
//
// Production dependencies (shipped with the app): every license must be allowed,
// otherwise an exception with a reason is required -> exit code 1.
// Development dependencies (never shipped): violations are only reported as warnings.
//
// SPDX expressions are evaluated: "A OR B" passes if one side is allowed,
// "A AND B" only if both are. Anything that is not a valid expression needs an exception.
//
// The package list comes from package-lock.json (which also marks dev-only packages),
// the license from the lockfile or, if missing there, from the installed package.json.
// No extra dependency is needed for this.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'license-check.json'), 'utf8'));
const allowed = new Set(config.allowed);
const exceptions = new Map(Object.entries(config.exceptions ?? {}));

function licenseOf(path, entry)
{
    if (entry.license) return entry.license;
    const manifest = join(root, path, 'package.json');
    if (!existsSync(manifest)) return 'UNKNOWN';
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    if (typeof pkg.license === 'string') return pkg.license;
    if (pkg.license?.type) return pkg.license.type;
    // Old format: "licenses": [{ "type": "MIT" }, ...]
    if (Array.isArray(pkg.licenses)) return pkg.licenses.map(l => l.type ?? l).join(' OR ');
    return 'UNKNOWN';
}

/** All packages of the lockfile, split into production and development (dev: true) */
function scan()
{
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    const production = {};
    const development = {};
    for (const [path, entry] of Object.entries(lock.packages ?? {}))
    {
        // '' is the project itself; links point to workspace folders
        if (!path || entry.link) continue;
        // Optional platform-specific binaries (e.g. fsevents on macOS) are often not installed
        if (entry.optional && !existsSync(join(root, path))) continue;
        const name = entry.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
        const id = `${name}@${entry.version}`;
        const info = { licenses: licenseOf(path, entry), repository: entry.resolved ?? '' };
        (entry.dev ? development : production)[id] = info;
    }
    return { production, development };
}

// Minimal SPDX expression evaluator (OR, AND, parentheses, WITH exceptions ignored).
function isAllowed(expression)
{
    const tokens = expression.replace(/[()]/g, p => ` ${p} `).trim().split(/\s+/);
    let pos = 0;
    const parseOr = () =>
    {
        let value = parseAnd();
        while (tokens[pos] === 'OR')
        {
            pos++;
            const right = parseAnd();
            value = value || right;
        }
        return value;
    };
    const parseAnd = () =>
    {
        let value = parseAtom();
        while (tokens[pos] === 'AND')
        {
            pos++;
            const right = parseAtom();
            value = value && right;
        }
        return value;
    };
    const parseAtom = () =>
    {
        const token = tokens[pos++];
        if (token === '(')
        {
            const value = parseOr();
            pos++; // ')'
            return value;
        }
        if (tokens[pos] === 'WITH')
        {
            pos += 2;
        }
        return allowed.has(token);
    };
    const result = parseOr();
    return pos === tokens.length && result;
}

function evaluate(packages)
{
    const violations = [];
    const usedExceptions = new Set();
    for (const [id, info] of Object.entries(packages))
    {
        const name = id.slice(0, id.lastIndexOf('@'));
        const license = Array.isArray(info.licenses) ? info.licenses.join(' OR ') : String(info.licenses ?? 'UNKNOWN');
        const exceptionKey = [id, name].find(key => exceptions.has(key));
        if (exceptionKey)
        {
            usedExceptions.add(exceptionKey);
            continue;
        }
        if (!isAllowed(license))
        {
            violations.push({ id, license, repository: info.repository ?? '' });
        }
    }
    return { violations, usedExceptions, total: Object.keys(packages).length };
}

function print(title, { violations, total })
{
    console.log(`${title}: ${total} packages, ${violations.length} not on the allowlist`);
    for (const v of violations.sort((a, b) => a.id.localeCompare(b.id)))
    {
        console.log(`  ${v.id.padEnd(50)} ${v.license.padEnd(28)} ${v.repository}`);
    }
}

const packages = scan();
const production = evaluate(packages.production);
const development = evaluate(packages.development);

print('Production dependencies', production);
print('Development dependencies (warning only)', development);

const used = new Set([...production.usedExceptions, ...development.usedExceptions]);
for (const [key, { reason }] of exceptions)
{
    console.log(`${used.has(key) ? 'Exception' : 'Unused exception (remove it?)'}: ${key} – ${reason}`);
}

if (production.violations.length > 0)
{
    console.error('\nLicense check failed: add an allowed license or a justified exception in license-check.json.');
    process.exit(1);
}
console.log('\nLicense check passed.');
