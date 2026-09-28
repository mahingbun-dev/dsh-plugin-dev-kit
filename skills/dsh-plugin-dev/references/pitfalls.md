# Pitfalls: every red line, with why and fix

These are the mistakes that actually cost people hours. Each item: symptom →
cause → fix.

## P1 · Package without `dsh.bundle` installs but never activates

- Symptom: `dsh plugin add` succeeds, `list_plugins` shows the package, nothing
  loads; `--dump-config` has no row.
- Cause: the package is a plain dependency — only packages whose manifest
  declares `dsh.bundle.patch` contribute a patch layer
  (`packages/boot/plugin-manager/src/operations.ts` prints a warning).
- Fix: add `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` and the
  patch file with at least one `insert` row whose `name` is the package name.

## P2 · Stateful dsh dependency under `dependencies` → second instance

- Symptom: your plugin mutates state (a registry, a store, a cache) and other
  plugins see nothing; or duplicate tool names / double events.
- Cause: pnpm installed a physical copy of a stateful dsh package instead of
  sharing the host's instance.
- Fix: move it to `peerDependencies` + `devDependencies` (same range). Peers
  resolve to the running installation's copy via dsh's runtime resolution; the
  dev copy is for your type checker/tests only. See
  [seam-provider.md](seam-provider.md) § dependency discipline.

## P3 · Git install fails or loads stale code

- Symptom: first `dsh plugin add github:you/pkg` fails with a build/allowance
  error; or a TypeScript package loads nothing (`lib/` missing).
- Cause: git installs fetch **sources**; pnpm ≥10 refuses to run `prepare`
  until allowlisted.
- Fix (author): ship a self-contained `prepare` script that builds entry
  points without monorepo context. Fix (user): copy the exact key pnpm printed
  into the profile's `pnpm-workspace.yaml` under `allowBuilds: { "pkg": true }`
  and re-run. Treat the allowance as executing the author's code at install
  time; pin a commit (`github:you/pkg#<sha>`). Avoid the whole problem:
  publish to npm or ship a tarball (`pnpm pack`) — neither needs any build
  permission.

## P4 · Patch override loses config keys

- Symptom: after your override row, the target plugin behaves like defaults.
- Cause: patches **replace** a row's whole `config`; they never deep-merge.
- Fix: restate every key the row needs (copy the row from `--dump-config` and
  edit values). Same for overriding shipped rows: copy then modify.

## P5 · Hand-edited profile files

- Symptom: broken profile, lock contention, or changes silently reverted.
- Cause: `dsh plugin` owns the profile's `package.json`, `pnpm-lock.yaml`,
  `cordis.patch.yml`, and `pnpm-workspace.yaml` with locking + reconciliation.
- Fix: use `dsh plugin --profile <name> add/remove`; toggle enable/disable
  through the plugin manager (Web UI or the `plugin_manager` tool), which
  writes an override row's `disabled` for you. Never create packages under
  `$DSH_HOME`; never run pnpm inside the profile directory.

## P6 · Mixed export forms

- Symptom: your `apply` never runs.
- Cause: the module exports both a default (class) and named function-plugin
  exports; the Loader drops the function-plugin namespace.
- Fix: one form per module. Function plugin: `export const name` /
  `export const inject` / `export function apply`. Service: default-export the
  class only.

## P7 · Registration without disposer

- Symptom: after HMR or disable, tools/listeners from the old generation are
  still live; duplicate events.
- Cause: registration outside `ctx.effect`/registry `register()` (top-level
  side effects are the classic case).
- Fix: do all registration inside `apply` through APIs that return disposers;
  for multi-step setup use one `ctx.effect(function* () { ... yield cleanup })`
  so teardown is ordered.

## P8 · Missing `@deepseek-ai/cordis` peer declaration

- Symptom: hygiene/dependency checks fail; resolution surprises.
- Fix: `@deepseek-ai/cordis` goes in `peerDependencies` **and**
  `devDependencies` with the same range, in every plugin package.

## P9 · `!!js` in static manifest fields

- Symptom: config gate / loader rejects the patch.
- Cause: only `disabled` accepts an expression; `id`, `name`, `inject`,
  `intercept`, `isolate`, and `config` static fields must be literal YAML.
- Fix: move computed values behind injected services (`inject: [myStartup]`,
  then `config: { port: !!js ctx.myStartup.port ?? 8080 }` is the sanctioned
  pattern for CLI-driven values).

## P10 · UI plugin invisible or crashed

- Symptom: bundle installed, page unchanged; or console slot crash.
- Cause: wrong slot name (query `Slots.listSubTree` first), hardcoded colors
  instead of theme tokens (breaks dark theme), importing client packages not
  declared in `dsh.client.inject`, or `exports["./client"]`/`dsh.client`
  mismatch.
- Fix: follow [ui-and-mcp.md](ui-and-mcp.md); verify in the connected page in
  light and dark themes; restart to load fresh client modules after replacing
  installed code.

## P11 · Secrets in the wrong place

- Symptom: credential leaked into logs/git; or config rejects the value.
- Fix: config carries **references** (env var names via
  `.role('credential-ref')`); resolve per operation. Never commit real values;
  never print resolved values in tool output.

## P12 · Verified nothing, shipped anyway

- Symptom: "should work" — then does not.
- Fix: climb the verification ladder in [testing.md](testing.md):
  `--dump-config` → boot result fields → one real end-to-end →
  automated REAL-composition test. Report exactly which rung you reached.

## P13 · `inject` typo → plugin silently PENDING forever

- Symptom: package installed, row present in `--dump-config`, no error
  anywhere — the plugin just never activates.
- Cause: an injected key that no running service provides (typo, wrong key).
  Missing injections do not error; the plugin waits for the service to appear.
- Fix: check the activation state with the inspect tools
  (`cordis_inspect_list` inside a running Harness) or compare your
  `inject` list against the service keys in `--dump-config`'s `ctx.` columns.
  Common case: `inject: ['tool']` instead of `['tools']`.

## P14 · Patch row present but module fails to load

- Symptom: `--dump-config` shows your row; boot logs a module-resolution
  failure for it.
- Cause: the row's `name` does not resolve to your package — typo, or the row
  references a source path style instead of the installed package name.
- Fix: row `name` must be exactly the package `name` (Node resolves the
  installed code through it); check `files`/`exports` actually ship the entry
  module, and for git installs that `prepare` built it (P3).

Full diagnosis trees by symptom: [troubleshooting.md](troubleshooting.md).
