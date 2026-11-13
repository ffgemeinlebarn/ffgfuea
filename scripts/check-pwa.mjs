// Checks the PWA essentials of the production build. Lighthouse 12 removed the PWA
// category (and the installable-manifest / service-worker audits), so this replaces it:
// the manifest must be installable (Chrome criteria) and the Angular service worker built.
//
//   node scripts/check-pwa.mjs [dist/ffgfuea/browser]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist/ffgfuea/browser';
const errors = [];
const check = (ok, message) => ok || errors.push(message);

const indexHtml = join(dist, 'index.html');
check(existsSync(indexHtml), `${indexHtml} missing – run "ng build" first`);
const html = existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : '';
const manifestHref = html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/)?.[1];
check(manifestHref, 'index.html does not link a manifest (<link rel="manifest">)');
check(/<meta[^>]+name="theme-color"/.test(html), 'index.html has no <meta name="theme-color">');

const manifestPath = join(dist, manifestHref ?? 'manifest.webmanifest');
if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    check(manifest.name || manifest.short_name, 'manifest: name or short_name required');
    check(manifest.start_url, 'manifest: start_url required');
    check(['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay'].includes(manifest.display),
        'manifest: display must be fullscreen, standalone, minimal-ui or window-controls-overlay');
    const icons = manifest.icons ?? [];
    for (const size of ['192x192', '512x512']) {
        const icon = icons.find((i) => i.sizes?.split(/\s+/).includes(size) && (i.type ?? 'image/png') === 'image/png');
        check(icon, `manifest: PNG icon ${size} required`);
        if (icon) {
            check(existsSync(join(dist, icon.src)), `manifest: icon ${icon.src} not found in build`);
        }
    }
} else {
    errors.push(`${manifestPath} missing`);
}

check(existsSync(join(dist, 'ngsw-worker.js')), 'ngsw-worker.js missing (service worker not built)');
check(existsSync(join(dist, 'ngsw.json')), 'ngsw.json missing (service worker not built)');

if (errors.length) {
    console.error(`PWA check failed:\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
}
console.log('PWA check passed (manifest installable, service worker built).');
