// Installiert die Git-Hooks aus lefthook.yml (npm-Script "prepare", läuft bei npm ci/npm install).
//
// Übersprungen wird, ohne npm ci scheitern zu lassen:
//   - LEFTHOOK=0 (oder false) gesetzt
//   - in CI (CI gesetzt), außer LEFTHOOK=1
//   - kein Git-Repository (z. B. Docker-Build, entpacktes Tarball)
//   - in einem verknüpften Git-Worktree: Die Hooks liegen im gemeinsamen .git/hooks des
//     Haupt-Repos, und lefthook trägt dort den absoluten Pfad zur eigenen Binärdatei ein.
//     Eine Installation aus dem Worktree würde die Hooks des Haupt-Repos auf diesen Worktree
//     umbiegen. Die im Haupt-Repo installierten Hooks gelten ohnehin auch für alle Worktrees.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const aktiv = wert => wert !== undefined && wert !== '' && wert !== '0' && wert !== 'false';

function skip(grund)
{
    console.log(`lefthook: Hooks nicht installiert (${grund}).`);
    process.exit(0);
}

if (process.env.LEFTHOOK === '0' || process.env.LEFTHOOK === 'false') skip('LEFTHOOK=0');
if (aktiv(process.env.CI) && !aktiv(process.env.LEFTHOOK)) skip('CI');

const git = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) skip('kein Git-Repository');
const [gitDir, commonDir] = git.stdout.trim().split('\n').map(pfad => resolve(pfad));
if (gitDir !== commonDir) skip('Git-Worktree, Hooks werden im Haupt-Repo installiert');

const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'lefthook.cmd' : 'lefthook');
if (!existsSync(bin)) skip('lefthook nicht installiert');

const ergebnis = spawnSync(bin, ['install'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (ergebnis.status !== 0) console.warn('lefthook: "lefthook install" fehlgeschlagen, bitte von Hand ausführen (npx lefthook install).');
