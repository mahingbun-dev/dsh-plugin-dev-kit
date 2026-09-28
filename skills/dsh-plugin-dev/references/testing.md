# Testing and verification

The verification ladder — climb it in order; do not skip to "it should work":

1. **Composition**: `dsh --profile <name> --dump-config` (keyless) shows your
   rows in the composed tree. A missing row here means a manifest/patch problem,
   not a code problem.
2. **Activation**: boot the profile; read the installer/boot result fields
   (`application`, `warnings`, `restart-required`, `failed`, `overridden`).
   `overridden` means a higher-priority layer replaced your row (check layer
   order); `restart-required` means not live yet.
3. **Capability**: exercise the tool/widget end-to-end once.
4. **Durable proof**: automated tests (below).

## Out-of-tree plugins (standalone, no monorepo needed)

Unit-test the pure logic with Node's built-in runner — no dsh required:

```js
// tests/plugin.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { rollDice } from '../index.js'

test('rollDice returns bounds', () => {
  for (let i = 0; i < 100; i++) {
    const v = rollDice(6)
    assert.ok(v >= 1 && v <= 6)
  }
})
```

```sh
node --test
```

Plus manifest assertions (cheap and surprisingly effective): package.json has
`dsh.bundle.patch`; the patch's row `name` equals the package `name`; every
file referenced by `exports` exists. `examples/dice-tool/tests/` does exactly
this. Run `node --check index.js` in CI for syntax.

## REAL-composition tests (the dsh testing contract)

From `docs/testing.md`: product-visible plugins need a test that boots the
**real Loader** with a test-only `cordis.yml` — not hand-wired
`ctx.plugin(...)` calls, which bypass the composition path where real bugs live
(config validation, inject gating, patch dialect, module resolution). Mock only
external services and nondeterministic inputs.

Skeleton adapted from `packages/llm/llm-deepseek/tests/loader-composition.spec.ts`,
with the three things that surprise everyone answered inline:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'          // (a) the skeleton bug everyone copies
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-loader'
import { Include } from '@deepseek-ai/cordis-include'

// (b) WHERE the loader deps come from: run this test inside a dsh checkout
// (they resolve via the workspace) or add @deepseek-ai/cordis-loader and
// -include to your test workspace's devDependencies.

const ctx = new Context()
await ctx.plugin(Loader)
ctx.loader.builtins.include = Include
// (c) `baseUrl` is a Loader config option — it decides how your fixture's
// relative module names resolve. Point it at your package directory.
ctx.baseUrl = fileURLToPath(new URL('..', import.meta.url))
// (d) your plugin declares `inject: ['tools']`, so provide stand-ins for the
// services the fixture needs, or the plugin stays PENDING forever:
ctx.provide('systemPrompt', fakeSystemPrompt)
ctx.provide('tools', fakeToolRegistry)            // record register() calls here
ctx.loader.create({ name: 'cordis:include', config: { path: fileURLToPath(new URL('./fixtures/cordis.yml', import.meta.url)) } })
await ctx.loader.await()
// assert: fakeToolRegistry recorded your tool, service provided, event observed
```

`fixtures/cordis.yml` uses the same row dialect as production
(`- insert: [{ id, name, config }]`). Keep one fixture per scenario; assert on
model-visible or user-visible outcomes (a registered tool's presence, a
service's method returning canned data). `examples/dice-tool` shows the
standalone unit+manifest half; compose this skeleton with it for the durable
proof.

## In-repo (monorepo) test floors

- Package unit tests: `packages/<group>/<pkg>/tests/*.spec.ts` (vitest,
  source-plane resolution via tsconfig paths — never through built `lib/`).
- REAL-composition: package-level in the package's `tests/`; profile-level in
  `apps/cli/tests/profiles/` (see `apps/cli/tests/profiles/headless/tests/`
  and its shared `harness.ts`).
- Profile resolution correctness (peer interception, shared instances):
  `apps/cli/tests/profiles/headless/tests/profile-resolution.ts` is the matrix
  to imitate when your plugin declares peers.
- Gates before push (in-repo contributors): `pnpm run doc-sync`,
  `constraints`, `typecheck`, `lint`, `build`, `hygiene` — and
  `test:coverage`, not `test`, is the CI coverage gate (per-file 100% on
  `packages/*/*/src`).

## Design your test plan up front

Plan unit + composition + transcript/output coverage when adding a capability:
capability seams, lifecycle paths, and what the model/user sees each need a
test. If a snapshot harness is missing support for your surface, add it in the
same change rather than skipping the test.
