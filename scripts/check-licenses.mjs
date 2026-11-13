// Checks the licenses of all installed dependencies against license-check.json.
//
//   npm run check:licenses
//
// Production dependencies (shipped with the app): every license must be allowed,
// otherwise an exception with a reason is required -> exit code 1.
// Development dependencies (never shipped): violations are only reported as warnings.
//
// SPDX expressions are evaluated: "A OR B" passes if one side is allowed,
// "A AND B" only if both are. Guessed licenses ("MIT*") always need an exception.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as checker from 'license-checker-rseidelsohn';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'license-check.json'), 'utf8'));
const allowed = new Set(config.allowed);
const exceptions = new Map(Object.entries(config.exceptions ?? {}));

function scan(options) {
    return new Promise((resolve, reject) => {
        checker.init({ start: root, excludePrivatePackages: true, ...options }, (err, packages) =>
            err ? reject(err) : resolve(packages));
    });
}

// Minimal SPDX expression evaluator (OR, AND, parentheses, WITH exceptions ignored).
function isAllowed(expression) {
    const tokens = expression.replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/);
    let pos = 0;
    const parseOr = () => {
        let value = parseAnd();
        while (tokens[pos] === 'OR') {
            pos++;
            const right = parseAnd();
            value = value || right;
        }
        return value;
    };
    const parseAnd = () => {
        let value = parseAtom();
        while (tokens[pos] === 'AND') {
            pos++;
            const right = parseAtom();
            value = value && right;
        }
        return value;
    };
    const parseAtom = () => {
        const token = tokens[pos++];
        if (token === '(') {
            const value = parseOr();
            pos++; // ')'
            return value;
        }
        if (tokens[pos] === 'WITH') {
            pos += 2;
        }
        return allowed.has(token);
    };
    const result = parseOr();
    return pos === tokens.length && result;
}

function evaluate(packages) {
    const violations = [];
    const usedExceptions = new Set();
    for (const [id, info] of Object.entries(packages)) {
        const name = id.slice(0, id.lastIndexOf('@'));
        const license = Array.isArray(info.licenses) ? info.licenses.join(' OR ') : String(info.licenses ?? 'UNKNOWN');
        const exceptionKey = [id, name].find((key) => exceptions.has(key));
        if (exceptionKey) {
            usedExceptions.add(exceptionKey);
            continue;
        }
        const guessed = license.endsWith('*');
        if (guessed || !isAllowed(license)) {
            violations.push({ id, license, repository: info.repository ?? '' });
        }
    }
    return { violations, usedExceptions, total: Object.keys(packages).length };
}

function print(title, { violations, total }) {
    console.log(`${title}: ${total} packages, ${violations.length} not on the allowlist`);
    for (const v of violations.sort((a, b) => a.id.localeCompare(b.id))) {
        console.log(`  ${v.id.padEnd(50)} ${v.license.padEnd(28)} ${v.repository}`);
    }
}

const production = evaluate(await scan({ production: true }));
const development = evaluate(await scan({ development: true }));

print('Production dependencies', production);
print('Development dependencies (warning only)', development);

const used = new Set([...production.usedExceptions, ...development.usedExceptions]);
for (const [key, { reason }] of exceptions) {
    console.log(`${used.has(key) ? 'Exception' : 'Unused exception (remove it?)'}: ${key} – ${reason}`);
}

if (production.violations.length > 0) {
    console.error('\nLicense check failed: add an allowed license or a justified exception in license-check.json.');
    process.exit(1);
}
console.log('\nLicense check passed.');
