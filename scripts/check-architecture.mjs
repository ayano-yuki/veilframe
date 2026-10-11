import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve, relative } from 'node:path';
import ts from 'typescript';

const config = JSON.parse(await readFile('architecture.json', 'utf8'));
const failures = [];
const modules = new Map();
const camelCase = /^[a-z][A-Za-z0-9]*$/;
const pascalCase = /^[A-Z][A-Za-z0-9]*$/;
const kebabCase = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ignored = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  '.git',
  '.agents',
  '.codex',
  '.aws',
  'coverage',
  'test-results',
  'playwright-report',
  'screenshots',
  '.vercel',
]);

function fail(path, rule) {
  failures.push(`${path}: ${rule}`);
}
function boundary(path) {
  const parts = path.split('/');
  return parts[0] === 'src' ? { layer: parts[1], slice: parts[2] } : undefined;
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) {
      continue;
    }
    const path = directory === '.' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (
        (path.startsWith('src/') || path.startsWith('server/')) &&
        !kebabCase.test(entry.name)
      ) {
        fail(path, 'directory-name');
      }
      await walk(path);
    } else if (/\.(ts|vue|mjs)$/.test(path)) {
      await inspect(path);
    }
  }
}
async function inspect(path) {
  const filename = path.split('/').at(-1);
  if (!config.frameworkNames.includes(path)) {
    const stem = filename.replace(/\.(ts|vue|mjs)$/, '').replace(/\.test$/, '');
    if (
      extname(path) === '.vue' ? !pascalCase.test(stem) : !kebabCase.test(stem)
    ) {
      fail(path, 'file-name');
    }
  }
  const original = await readFile(path, 'utf8');
  if (path.startsWith('src/')) {
    const parts = path.split('/');
    if (!config.layers.includes(parts[1]) || parts.length < 4) {
      fail(path, 'fsd-placement');
    }
    if (path.endsWith('.vue') && !parts.includes('ui')) {
      fail(path, 'vue-ui-segment');
    }
  }
  if (
    path.startsWith('server/') &&
    !['api', 'application', 'domain', 'infrastructure'].includes(
      path.split('/')[1],
    )
  ) {
    fail(path, 'server-placement');
  }
  if (
    !path.startsWith('scripts/') &&
    /(?:@ts-(?:ignore|nocheck)|(?:oxlint|eslint|v8|istanbul)\s*(?:-| )?ignore|oxlint-disable|eslint-disable)/.test(
      original,
    )
  ) {
    fail(path, 'check-suppression');
  }
  const code = path.endsWith('.vue')
    ? (original.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '')
    : original;
  const tree = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      fail(path, 'barrel-export');
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (!argument || !ts.isStringLiteral(argument)) {
        fail(path, 'dynamic-import-must-be-literal');
      } else {
        imports.push(argument.text);
      }
    }
    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      !camelCase.test(node.name.text)
    ) {
      fail(path, `camel-case:${node.name.text}`);
    }
    if (
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node)) &&
      node.name &&
      !pascalCase.test(node.name.text)
    ) {
      fail(path, `pascal-case:${node.name.text}`);
    }
    if (
      ts.isIdentifier(node) &&
      ['localStorage', 'sessionStorage'].includes(node.text)
    ) {
      fail(path, 'unapproved-storage-api');
    }
    if (
      ts.isIdentifier(node) &&
      node.text === 'indexedDB' &&
      !path.endsWith('.test.ts') &&
      !path.startsWith('src/entities/record/api/')
    ) {
      fail(path, 'indexeddb-boundary');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  modules.set(path, imports);
}
await walk('.');
for (const publicFile of config.publicFiles) {
  try {
    await readFile(publicFile);
  } catch {
    fail(publicFile, 'public-file-missing');
  }
}
const edges = new Map();
for (const [path, imports] of modules) {
  const from = boundary(path);
  const destinations = [];
  for (const specifier of imports) {
    let target;
    if (specifier.startsWith('@fsd/')) {
      target = `src/${specifier.slice(5)}`;
    } else if (specifier.startsWith('.')) {
      target = relative(
        process.cwd(),
        resolve(dirname(path), specifier),
      ).replaceAll('\\', '/');
    } else {
      if (
        specifier === 'shaka-player' &&
        !path.includes('/entities/playback/api/') &&
        !path.endsWith('.test.ts')
      ) {
        fail(path, 'shaka-adapter-only');
      }
      if (
        specifier === 'idb' &&
        !path.includes('/entities/record/api/') &&
        !path.endsWith('.test.ts')
      ) {
        fail(path, 'idb-adapter-only');
      }
      continue;
    }
    const destination =
      [target, `${target}.ts`, `${target}.vue`].find((candidate) =>
        modules.has(candidate),
      ) ?? target;
    destinations.push(destination);
    const to = boundary(destination);
    const sameSlice =
      from && to && from.layer === to.layer && from.slice === to.slice;
    if (sameSlice && !specifier.startsWith('.')) {
      fail(path, 'same-slice-relative-import');
    }
    if (!sameSlice && to) {
      if (path.startsWith('src/') && !specifier.startsWith('@fsd/')) {
        fail(path, 'cross-slice-alias-import');
      }
      if (!config.publicFiles.includes(destination)) {
        fail(path, `private-import:${destination}`);
      }
      if (
        from &&
        from.layer !== 'shared' &&
        config.layers.indexOf(to.layer) <= config.layers.indexOf(from.layer)
      ) {
        fail(path, 'layer-dependency');
      }
      if (from?.layer === 'shared' && to.layer !== 'shared') {
        fail(path, 'shared-dependency');
      }
    }
    if (path.startsWith('server/') && to && to.layer !== 'shared') {
      fail(path, 'server-browser-dependency');
    }
    if (path.startsWith('src/') && destination.startsWith('server/')) {
      fail(path, 'browser-server-dependency');
    }
  }
  edges.set(path, destinations);
}
const visited = new Set();
function detectCycle(path, chain = new Set()) {
  if (chain.has(path)) {
    fail(path, 'import-cycle');
    return;
  }
  if (visited.has(path)) {
    return;
  }
  const next = new Set(chain);
  next.add(path);
  for (const target of edges.get(path) ?? []) {
    detectCycle(target, next);
  }
  visited.add(path);
}
for (const path of edges.keys()) {
  detectCycle(path);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Architecture: ${modules.size} modules checked.`);
}
