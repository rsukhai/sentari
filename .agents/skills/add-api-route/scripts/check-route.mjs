#!/usr/bin/env node
// Перевірка навички add-api-route: чи маршрут /api/<name> зроблено за процедурою.
// Виклик із кореня репозиторію: node .claude/skills/add-api-route/scripts/check-route.mjs <name>
// Код виходу: 0 — усе OK, 1 — є FAIL (або неправильний виклик).
// Лише вбудовані модулі Node: скрипт має працювати до будь-якого npm install.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Виклик: check-route.mjs <name>  (name — малі латинські літери, цифри, дефіси, напр. health)');
  process.exit(1);
}

// Корінь репозиторію — перша тека вгору з package.json: скрипт працює
// і з кореня, і з теки навички.
let root = process.cwd();
while (!existsSync(join(root, 'package.json'))) {
  const up = dirname(root);
  if (up === root) {
    console.error('FAIL не знайдено package.json — запускай усередині репозиторію');
    process.exit(1);
  }
  root = up;
}

const routePath = `app/api/${name}/route.ts`;
const schemaPath = `src/${name}.ts`;
const testPath = `tests/${name}.test.ts`;
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null);
const importsZod = (code) => /from\s+['"]zod['"]/.test(code);

let failed = false;
const check = (ok, message) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
};

const route = read(routePath);
check(route !== null, `${routePath} існує`);
if (route !== null) {
  check(
    /export\s+(?:async\s+)?(?:function|const)\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(route),
    `${routePath} експортує функцію HTTP-методу (GET, POST, …)`,
  );
  // Відома пастка курсу: tsc знає аліас @/, а vitest без resolve.alias — ні.
  check(!/from\s+['"]@\//.test(route), `${routePath} імпортує без аліасу @/ (відносний шлях)`);
  const fromSrc = new RegExp(`from\\s+['"](?:\\.\\./)+src/${name}['"]`).test(route);
  const schema = read(schemaPath);
  check(
    importsZod(route) || (fromSrc && schema !== null && importsZod(schema)),
    `zod-схема підключена: у маршруті напряму або через ${schemaPath}`,
  );
}

const test = read(testPath);
check(test !== null, `${testPath} існує`);
if (test !== null) {
  check(
    new RegExp(`from\\s+['"]\\.\\./app/api/${name}/route['"]`).test(test),
    `${testPath} імпортує обробник з ../app/api/${name}/route`,
  );
}

process.exit(failed ? 1 : 0);
