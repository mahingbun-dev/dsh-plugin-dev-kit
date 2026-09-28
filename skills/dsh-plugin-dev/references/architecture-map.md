# Architecture map: what your plugin plugs into

Distilled from the dsh architecture docs (`docs/architecture.md`,
`docs/cordis-primer.md`, `docs/capability-seams.md` on the dsh checkout / docs
site). Read this once to stop fighting the framework.

## Cordis in five ideas

DeepSeek Harness is an all-plugin agent harness on the vendored Cordis
framework (`vendor/cordis/`). There is no privileged core:

1. **A plugin is an object implementing Service** — a function
   `(ctx, config) => any` with optional `inject`/`Config`/`name` metadata, a
   `Service` subclass (default export), or an object with `apply(ctx, config)`.
2. **A context is a service repository.** A service claims a stable `ctx.<key>`
   (`ctx.sessions`, `ctx.tools`, `ctx.llm`, `ctx.shell`, `ctx.fs`, ...). Other
   plugins find services **by key**, never by importing implementations.
3. **Declare dependencies via `inject`.** A plugin whose injected services are
   absent stays PENDING and activates automatically when they appear — load
   order is expressed by requirements, not boot scripts.
4. **Typed events are the communication fabric.** Event names are strongly
   typed through TypeScript declaration merging; payload and dispatch mode are
   part of the public contract (`@mode` tag in dsh sources).
5. **Registrations are reversible effects.** Everything a plugin contributes is
   installed through `ctx.effect()` / `ctx.on()` / registry `register()` calls
   that return disposers; teardown unrolls them in reverse order.

## Event dispatch modes

| Method | Awaited | Order | Return | Use for |
| --- | --- | --- | --- | --- |
| `ctx.emit` | no | registration order | no | notify / observe (`session/event`, `agent/status`) |
| `ctx.parallel` | yes | concurrent, allSettled | AggregateError | fan-out (`session/flush`) |
| `ctx.serial` | yes | sequential await | yes | ordered phases (`agent/created`, `agent/turn-stopping`) |
| `ctx.bail` | no | until someone bails | yes | sync decisions |
| `ctx.waterfall` | no | onion middleware | yes | policy interception (`agent/pre-step`, `agent/request`, `tools/*`, `llm/stream`) |

**Waterfall semantics** (`vendor/cordis/src/events.ts`): the listener receives
`(...args, next)`. Call `next()` to delegate to the next listener and finally
the dispatcher's built-in behavior; return without calling `next()` to veto the
whole chain. The return value is the outermost listener's return value.
Cooperative listeners mutate a shared request/decision object and delegate.

**Scoped dispatch**: listeners registered on an agent scope (`this: Scoped<Agent>`
annotations) only receive events for that agent and its descendants — one
process, one bus, isolation by context filtering.

## Capability seams

A seam is a swappable capability with three roles:

- **Service Definition** — the Cordis `Service` that owns `ctx.<key>` and the
  vocabulary types (an abstract class like `ShellExecutor`, or a concrete
  registry like `LlmRuntime`), never a bare TS interface.
- **Service Provider** — implements it (`extends ShellExecutor` or calls
  `ctx.llm.registerAdapter(...)`).
- **Consumer** — injects the key and calls `ctx.<key>` methods.

Canonical example: `dsh-shell` (Definition) / `dsh-bash-local`,
`dsh-bash-sandbox`, `dsh-pwsh-local` (Providers) / `dsh-tool-bash` (Consumer).
Point fs + subprocess at a remote sandbox and Bash, PTY, and LSP move with
them — no consumer changes. One seam registry with 30+ seams lives in
`docs/capability-seams.md`.

## Composition: profiles, bundles, patches

A running `dsh` is a plugin tree composed from ordered layers:

1. Each bundle patch named in the profile's `dsh.profile.bundles` list, in
   list order (`@deepseek-ai/dsh-base` is the shared first layer).
2. The profile's own `cordis.patch.yml`.
3. The home-level `$DSH_HOME/cordis.patch.yml`.
4. Each `--patch <path>` overlay, in argv order.

Later layers win per row, matched by `id`, **replacing the row's whole
`config`** (no deep-merge). `--dump-config` prints the composed result; any row
it prints can be overridden by a later patch.

## The turn (what your tool plugs into)

A **step** is one model request plus the tools it calls; a **turn** is zero or
more steps. Per step: `agent/pre-step` (waterfall, input accepted/rewritten) →
prompt sections + tool schemas assembled → request derived **from the session
log** (`deriveMessages()`; a runtime invariant asserts request == log
projection) → `ctx.llm.stream` → tool calls dispatched through
`tools/pre-execute` (approval, fail-closed) → `tools/execute` →
`tools/post-execute` → `tool/result` appended to the log → repeat or end.

Model-visible ⟺ logged: anything that reaches a model request must be
reconstructable from the append-only session log. Your tool's results get this
for free by returning a JSON value from `execute`.

## Where the authoritative docs live

- Docs site (public): `develop/basic/*` (first plugin, tool, config, publish),
  `develop/framework/*`, `develop/cordis-tutorial/*` (7 hands-on chapters),
  `reference/*` (primer, subsystems, cookbook).
- In a dsh checkout: `docs/` mirrors the site; `packages/cookbook` guides for
  in-repo contributors; `apps/cli/reference/README.md` owns CLI/profile
  mechanics.
