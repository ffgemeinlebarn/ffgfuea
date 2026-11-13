// Prints a readable summary of a SARIF file and exits with 1 if it contains
// results at level "error" or "warning" (notes are listed but do not fail).
//
//   node scripts/sarif-summary.mjs <file.sarif>
//   node scripts/sarif-summary.mjs --merge <out.sarif> <in.sarif>...   (combine runs first)
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
let file;
let sarif;
if (args[0] === '--merge' && args.length >= 3) {
    file = args[1];
    const inputs = args.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
    sarif = { ...inputs[0], runs: inputs.flatMap((s) => s.runs ?? []) };
    writeFileSync(file, JSON.stringify(sarif, null, 2));
} else if (args.length === 1) {
    file = args[0];
    sarif = JSON.parse(readFileSync(file, 'utf8'));
} else {
    console.error('usage: node scripts/sarif-summary.mjs <file.sarif> | --merge <out.sarif> <in.sarif>...');
    process.exit(2);
}

const findings = [];

for (const run of sarif.runs ?? []) {
    const rules = new Map();
    for (const rule of run.tool?.driver?.rules ?? []) {
        rules.set(rule.id, rule);
    }
    for (const result of run.results ?? []) {
        if (result.suppressions?.length) {
            continue;
        }
        const rule = rules.get(result.ruleId) ?? run.tool?.driver?.rules?.[result.ruleIndex];
        const level = result.level ?? rule?.defaultConfiguration?.level ?? 'warning';
        const location = result.locations?.[0]?.physicalLocation;
        const path = location?.artifactLocation?.uri ?? '?';
        const line = location?.region?.startLine ?? '?';
        const severity = rule?.properties?.['security-severity'];
        findings.push({
            level,
            ruleId: result.ruleId,
            name: rule?.shortDescription?.text ?? rule?.name ?? '',
            severity,
            where: `${path}:${line}`,
            message: result.message?.text?.replace(/\s+/g, ' ') ?? '',
        });
    }
}

const order = { error: 0, warning: 1, note: 2, none: 3 };
findings.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9) || a.where.localeCompare(b.where));

if (findings.length === 0) {
    console.log(`No findings (${file}).`);
    process.exit(0);
}

for (const f of findings) {
    const sev = f.severity ? ` [security-severity ${f.severity}]` : '';
    console.log(`${f.level.toUpperCase().padEnd(7)} ${f.ruleId}${sev}`);
    console.log(`        ${f.name}`);
    console.log(`        ${f.where}`);
    console.log(`        ${f.message}`);
    console.log('');
}

const failing = findings.filter((f) => f.level === 'error' || f.level === 'warning');
const counts = Object.entries(
    findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] ?? 0) + 1 }), {}),
).map(([level, n]) => `${n} ${level}`).join(', ');
console.log(`${findings.length} finding(s): ${counts}. Report: ${file}`);
process.exit(failing.length > 0 ? 1 : 0);
