// Zeigt den Stand eines Pull Requests im Terminal: Checks (Pflicht/optional), Logs fehlgeschlagener
// Jobs, offene Code-Scanning-Alerts (CodeQL, OSV-Scanner) und das Review. Gedacht für Menschen und
// für Claude nach dem Push, damit Befunde, die nur in CI entstehen (v. a. CodeQL), sofort sichtbar werden.
//
//   npm run pr:status                    PR des aktuellen Branches
//   npm run pr:status -- 42              bestimmter PR
//   npm run pr:status -- --watch         erst warten, bis alle Checks fertig sind
//
// Exit 0: alle Checks grün und keine offenen Alerts. Exit 1: sonst. Braucht die GitHub CLI (gh).
import { execFile } from 'node:child_process';

function gh(args)
{
    return new Promise(fertig =>
    {
        execFile('gh', args, { maxBuffer: 50 * 1024 * 1024 }, (fehler, stdout, stderr) =>
        {
            const code = fehler ? (typeof fehler.code === 'number' ? fehler.code : 1) : 0;
            fertig({ code, stdout, stderr });
        });
    });
}

function json(text, ersatz)
{
    try
    {
        return JSON.parse(text);
    }
    catch
    {
        return ersatz;
    }
}

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const nummer = args.find(a => /^\d+$/.test(a));

const pr = json((await gh(['pr', 'view', ...(nummer ? [nummer] : []), '--json', 'number,title,url,reviewDecision,reviewRequests,isDraft,mergeStateStatus'])).stdout, null);
if (pr === null)
{
    console.error('Kein Pull Request gefunden (Branch gepusht und PR angelegt?).');
    process.exit(2);
}
console.log(`PR #${pr.number}: ${pr.title}\n${pr.url}\n`);

if (watch)
{
    console.log('Warte auf Checks …');
    await gh(['pr', 'checks', String(pr.number), '--watch', '--interval', '20']);
}

const checks = json((await gh(['pr', 'checks', String(pr.number), '--json', 'name,workflow,bucket,link'])).stdout, []);
const pflicht = new Set(json((await gh(['pr', 'checks', String(pr.number), '--required', '--json', 'name'])).stdout, []).map(c => c.name));

const symbol = { pass: '✔', fail: '✘', pending: '…', skipping: '–', cancel: '⊘' };
const reihenfolge = { fail: 0, cancel: 1, pending: 2, pass: 3, skipping: 4 };
checks.sort((a, b) => (reihenfolge[a.bucket] ?? 9) - (reihenfolge[b.bucket] ?? 9) || a.name.localeCompare(b.name));

console.log('Checks' + (pflicht.size === 0 ? ' (keine Pflicht-Checks im Ruleset konfiguriert)' : ''));
for (const check of checks)
{
    const art = pflicht.has(check.name) ? 'Pflicht ' : 'optional';
    console.log(`  ${symbol[check.bucket] ?? '?'} ${art}  ${check.name}${check.workflow ? `  (${check.workflow})` : ''}`);
}

const fehlgeschlagen = checks.filter(c => c.bucket === 'fail');
for (const check of fehlgeschlagen)
{
    const job = /\/actions\/runs\/\d+\/job\/(\d+)/.exec(check.link ?? '')?.[1];
    if (!job) continue;
    const log = await gh(['run', 'view', '--job', job, '--log-failed']);
    // Zeilen haben das Format "<job>\t<step>\t<zeit> <text>". Aufräum-Schritte (Post …, Complete job)
    // sagen nichts über den Fehler und werden weggelassen.
    const zeilen = log.stdout.trimEnd().split('\n')
        .map(z =>
        {
            const [, schritt = '', ...rest] = z.split('\t');
            return { schritt, text: rest.join('\t').replace(/^\S+Z /, '') };
        })
        .filter(z => !z.schritt.startsWith('Post ') && z.schritt !== 'Complete job');
    const fehlerzeilen = zeilen.filter(z => z.text.includes('##[error]')).map(z => `${z.schritt}: ${z.text.replace('##[error]', '')}`);
    console.log(`\n── Log: ${check.name} ──`);
    if (fehlerzeilen.length > 0) console.log(`Fehler:\n${fehlerzeilen.slice(0, 20).join('\n')}\n`);
    console.log(`Letzte Zeilen des fehlgeschlagenen Schritts:\n${zeilen.slice(-25).map(z => z.text).join('\n')}`);
}

const alerts = json((await gh(['api', `repos/{owner}/{repo}/code-scanning/alerts?ref=refs/pull/${pr.number}/merge&state=open&per_page=100`])).stdout, []);
console.log(`\nOffene Code-Scanning-Alerts im PR: ${alerts.length}`);
for (const alert of alerts)
{
    const ort = alert.most_recent_instance?.location;
    const stufe = alert.rule?.security_severity_level ?? alert.rule?.severity ?? '?';
    console.log(`  ${alert.tool?.name} ${stufe.padEnd(8)} ${alert.rule?.id}  ${ort?.path ?? '?'}:${ort?.start_line ?? '?'}`);
    console.log(`      ${(alert.most_recent_instance?.message?.text ?? alert.rule?.description ?? '').replace(/\s+/g, ' ')}`);
    console.log(`      ${alert.html_url}`);
}

const angefragt = (pr.reviewRequests ?? []).map(r => r.login ?? r.name ?? r.slug).filter(Boolean);
console.log(`\nReview: ${pr.reviewDecision || 'keins erforderlich/vorhanden'}${angefragt.length > 0 ? `, angefragt bei ${angefragt.join(', ')}` : ''}${pr.isDraft ? ' (Entwurf)' : ''}`);
console.log(`Merge-Status: ${pr.mergeStateStatus}`);

const offen = checks.filter(c => c.bucket === 'pending');
process.exit(fehlgeschlagen.length > 0 || offen.length > 0 || alerts.length > 0 ? 1 : 0);
