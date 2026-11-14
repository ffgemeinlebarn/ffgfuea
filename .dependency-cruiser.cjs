// Architekturregeln für die Imports in src/ (https://github.com/sverweij/dependency-cruiser).
//
//   npm run depcruise              alle Regeln prüfen (Teil von npm run check und CI "Architektur")
//   npx depcruise src --output-type dot | dot -T svg > graph.svg    Abhängigkeitsgraph
//
// Neue Regel? Erst prüfen, ob der heutige Stand sie erfüllt, sonst bewusst als "warn" einführen.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: 'keine-zyklen',
            comment: 'Zyklische Imports erschweren Tests und Lazy Loading. Gemeinsames in eine eigene Datei auslagern. Zyklen nur über "import type" sind erlaubt, TypeScript entfernt sie beim Kompilieren.',
            severity: 'error',
            from: {},
            to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } }
        },
        {
            name: 'altberichte-isoliert',
            comment: 'Altberichte sind eine Übergangslösung (Issue #13) und werden entfernt. Nur die Einstellungsseite bindet sie ein, nichts Neues darauf aufbauen.',
            severity: 'error',
            from: { pathNot: ['^src/app/altberichte/', '^src/app/pages/settings-page/'] },
            to: { path: '^src/app/altberichte/' }
        },
        {
            name: 'shared-kennt-keine-seiten',
            comment: 'src/app/shared ist die gemeinsame Basis und darf nicht von Seiten (src/app/pages) abhängen.',
            severity: 'error',
            from: { path: '^src/app/shared/' },
            to: { path: '^src/app/pages/' }
        },
        {
            name: 'berichtslogik-rein',
            comment: 'report-data.ts ist reine Logik (Gruppierung, Texte) ohne Angular, Services oder UI, damit sie ohne TestBed testbar bleibt.',
            severity: 'error',
            from: { path: '^src/app/shared/reports/' },
            to: { path: ['^node_modules/@angular/', '^src/app/shared/(services|components|dialogs|pipes)/', '^src/app/pages/'] }
        },
        {
            name: 'kein-testcode-in-produktion',
            comment: 'Testhilfen (src/app/testing) und Specs nur aus Tests verwenden, sie landen sonst im Build.',
            severity: 'error',
            from: { path: '^src/', pathNot: ['\\.spec\\.ts$', '^src/app/testing/', '^src/test-setup\\.ts$'] },
            to: { path: ['^src/app/testing/', '\\.spec\\.ts$'] }
        },
        {
            name: 'keine-dev-abhaengigkeit-in-produktion',
            comment: 'Ausgelieferter Code darf nur dependencies verwenden, keine devDependencies.',
            severity: 'error',
            from: { path: '^src/', pathNot: ['\\.spec\\.ts$', '^src/app/testing/', '^src/test-setup\\.ts$'] },
            to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] }
        },
        {
            name: 'nicht-aufloesbar',
            comment: 'Import zeigt auf ein Modul, das es nicht gibt.',
            severity: 'error',
            from: {},
            to: { couldNotResolve: true }
        },
        {
            name: 'nicht-in-package-json',
            comment: 'Paket wird importiert, steht aber nicht in package.json (kommt nur zufällig transitiv mit).',
            severity: 'error',
            from: {},
            to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] }
        }
    ],
    options: {
        doNotFollow: { path: ['node_modules'] },
        tsConfig: { fileName: 'tsconfig.spec.json' },
        // Auch reine Typ-Imports zählen (für Zyklen und Architektur relevant)
        tsPreCompilationDeps: true,
        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'node', 'default', 'types'],
            mainFields: ['module', 'main', 'types', 'typings']
        },
        reporterOptions: {
            text: { highlightFocused: true }
        }
    }
};
