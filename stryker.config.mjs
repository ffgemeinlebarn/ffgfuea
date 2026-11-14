// Mutation-Testing mit StrykerJS (https://stryker-mutator.io): verändert den Code gezielt (Mutanten) und
// prüft, ob die Unit-Tests das bemerken. Überlebende Mutanten zeigen Stellen, die zwar ausgeführt,
// aber nicht wirklich geprüft werden – das sagt die Coverage nicht.
//
//   npm run mutation                         Bericht: reports/mutation/index.html
//   npm run mutation -- --mutate <datei>     andere Datei(en) prüfen (Specs in "command" ergänzen)
//
// Command-Runner statt Vitest-Runner: Der Vitest von @angular/build:unit-test ist intern und lässt sich
// von Stryker nicht direkt steuern (stryker-js#5811). Deshalb läuft pro Mutant `ng test` nur mit den
// passenden Specs (~3 s). Der Umfang ist bewusst auf reine Fachlogik begrenzt, wo Mutation-Testing am
// meisten bringt. Wöchentlich in CI (Workflow "Mutation", optional, blockiert nichts).
/** Fachlogik, die mutiert wird, jeweils mit ihrer Spec */
const dateien = [
    'src/app/shared/reports/report-data',
    'src/app/shared/services/pdf/pdf-dateinamen',
    'src/app/shared/models/ereignis-nummer/ereignis-nummer',
    'src/app/shared/services/data/statistics',
    'src/app/shared/services/barcode-scanner/barcode-scanner.service'
];

export default {
    testRunner: 'command',
    commandRunner: {
        command: `npx ng test --watch=false ${dateien.map(d => `--include=${d}.spec.ts`).join(' ')}`
    },
    mutate: dateien.map(d => `${d}.ts`),
    // Mehr parallele Läufe bremsen sich gegenseitig aus (jeder startet einen Angular-Build)
    concurrency: 2,
    timeoutMS: 60_000,
    reporters: ['clear-text', 'progress', 'html', 'json'],
    htmlReporter: { fileName: 'reports/mutation/index.html' },
    jsonReporter: { fileName: 'reports/mutation/mutation.json' },
    // Mutation-Score: ab 80 % grün, unter 60 % rot. Kein "break": Ergebnis ist ein Hinweis, kein Gate.
    thresholds: { high: 80, low: 60, break: null },
    // Nur geänderte Mutanten neu prüfen (Datei liegt in CI im Cache)
    incremental: true,
    incrementalFile: 'reports/stryker-incremental.json',
    tempDirName: '.stryker-tmp',
    // Mit führendem "/" nur im Wurzelverzeichnis ("reports" allein träfe auch src/app/shared/reports)
    ignorePatterns: ['/dist', '/coverage', '/reports', '/playwright-report', '/test-results', '/.claude', '/.stryker-tmp'],
    cleanTempDir: 'always'
};
