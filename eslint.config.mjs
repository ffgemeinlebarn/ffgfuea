// ESLint (Flat Config): angular-eslint für TypeScript und Templates, typescript-eslint
// strict (typ-informiert) und @stylistic für den Projektstil (Allman-Klammern, 4 Leerzeichen).
// Prettier scheidet aus, weil es keine Allman-Klammern kann.
//
//   npm run lint                  ganzes Projekt
//   npx eslint <datei> [...]      einzelne Dateien (z. B. aus Hooks)
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import angular from 'angular-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Projektstil, gilt für TypeScript und JavaScript */
const stil = {
    plugins: { '@stylistic': stylistic },
    rules: {
        '@stylistic/brace-style': ['error', 'allman', { allowSingleLine: true }],
        '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
        '@stylistic/semi': ['error', 'always'],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: 'avoidEscape' }],
        '@stylistic/comma-dangle': ['error', 'never'],
        '@stylistic/arrow-parens': ['error', 'as-needed'],
        '@stylistic/object-curly-spacing': ['error', 'always'],
        '@stylistic/array-bracket-spacing': ['error', 'never'],
        '@stylistic/comma-spacing': 'error',
        '@stylistic/key-spacing': 'error',
        '@stylistic/keyword-spacing': 'error',
        '@stylistic/space-before-blocks': 'error',
        '@stylistic/space-infix-ops': 'error',
        '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
        '@stylistic/no-trailing-spaces': 'error',
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
        '@stylistic/eol-last': 'error',
        '@stylistic/member-delimiter-style': 'error',
        '@stylistic/type-annotation-spacing': 'error',
        // === überall, nur `== null` als Kurzform für null oder undefined
        eqeqeq: ['error', 'smart']
    }
};

export default defineConfig(
    globalIgnores([
        'dist/',
        'out-tsc/',
        '.angular/',
        'node_modules/',
        'playwright-report/',
        'test-results/',
        'blob-report/',
        'coverage/',
        'reports/',
        'tmp/',
        '.claude/worktrees/'
    ]),

    {
        files: ['**/*.ts'],
        extends: [
            js.configs.recommended,
            tseslint.configs.strictTypeChecked,
            tseslint.configs.stylisticTypeChecked,
            angular.configs.tsRecommended,
            stil
        ],
        // Templates in Komponenten (template: `…`) mitprüfen
        processor: angular.processInlineTemplates,
        languageOptions: {
            parserOptions: {
                projectService: {
                    // Nicht in einer tsconfig enthalten, gehört fachlich zu den E2E-Tests
                    allowDefaultProject: ['playwright.config.ts'],
                    defaultProject: 'e2e/tsconfig.json'
                },
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            // Im Code durchgehend Array<T> statt T[]
            '@typescript-eslint/array-type': ['error', { default: 'generic' }],
            // process.env['CI'], Record-Zugriffe: Index-Signaturen bewusst mit Klammern
            '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
            // Zahlen in Template-Strings sind gewollt (Ereignisnummer, Anzahl, Druck …)
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
            // Kurze Callbacks wie () => this.dialog.close() oder setTimeout(() => …) sind gewollt;
            // geprüft wird weiterhin alles außerhalb von Arrow-Kurzformen.
            // Würde `wert as Date` in `wert!` umschreiben, widerspricht no-non-null-assertion
            '@typescript-eslint/non-nullable-type-assertion-style': 'off',
            // Weggelassene Felder per Rest-Destrukturierung ({ id, ...rest }) und _-Präfix sind gewollt
            '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            // async ngOnInit() u. ä. erfüllt Angulars void-Interfaces; Angular wartet darauf nicht und das ist gewollt
            '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { inheritedMethods: false } }],
            // `text || '–'`: ein leerer Text gilt bewusst als fehlend
            '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: { string: true } }],
            // catch (error) { reject(error); } reicht den Fehler unverändert weiter
            '@typescript-eslint/prefer-promise-reject-errors': ['error', { allowThrowingUnknown: true }],
            // Aus. Daten aus IndexedDB (ältere Stände), MAT und Backups halten sich nicht immer an die
            // Interfaces; `?.`/`?? []` darauf sind bewusste Schutzmaßnahmen. Zudem sieht die Regel nicht,
            // dass sich Werte während eines await ändern (abbruch.aborted), und meldet Index-Zugriffe
            // (liste[0]?.…) ohne noUncheckedIndexedAccess als unnötig.
            '@typescript-eslint/no-unnecessary-condition': 'off',
            // Leere Klassen mit Decorator (@Component für Test-Dialoge) sind in Angular üblich
            '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
            '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
            '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'ffg', style: 'kebab-case' }],
            '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'ffg', style: 'camelCase' }]
        }
    },

    // Testcode: Unit-Tests, Test-Hilfen und E2E
    {
        files: ['**/*.spec.ts', 'src/test-setup.ts', 'src/app/testing/**/*.ts', 'e2e/**/*.ts'],
        rules: {
            // Ein falsches `!` lässt den Test fehlschlagen – genau das soll er dann auch.
            '@typescript-eslint/no-non-null-assertion': 'off',
            // Fakes bilden asynchrone APIs nach (async () => wert), ohne selbst etwas abzuwarten.
            '@typescript-eslint/require-await': 'off',
            // expect(service.methode).toHaveBeenCalled() prüft Mocks, ruft die Methode nicht ohne `this` auf
            '@typescript-eslint/unbound-method': 'off'
        }
    },

    {
        files: ['**/*.html'],
        extends: [
            angular.configs.templateRecommended,
            angular.configs.templateAccessibility
        ],
        rules: {
            // wie im TypeScript-Code: `!= null` als Kurzform für null oder undefined
            '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }]
        }
    },

    {
        files: ['**/*.mjs', '**/*.js'],
        extends: [js.configs.recommended, stil],
        languageOptions: {
            globals: globals.node
        }
    }
);
