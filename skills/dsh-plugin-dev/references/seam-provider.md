# Service providers and capability seams

Read this when the user wants to implement or swap a **platform capability**
(filesystem, shell, sandbox, model adapter, session storage, ...) rather than
add a model-facing tool.

## When to create a seam vs reuse one

- Reuse: if a seam for the capability already exists (`docs/capability-seams.md`
  lists 30+), write a **Provider** for it. This is almost always the answer.
- Create: only when introducing a genuinely new swappable capability. A seam
  needs all three roles; one role alone is not a seam. If the "capability" has
  exactly one implementation and one consumer, pass a plain function/closure —
  do not build a service for it (inverse smell per `packages/AGENTS.md`).

## The three roles, concretely (shell seam)

**Definition** (`packages/shell/shell/src/index.ts`):

```ts
declare module '@deepseek-ai/cordis' {
  interface Context { shell: ShellExecutor }
}

export abstract class ShellExecutor extends Service {
  constructor(ctx: Context) { super(ctx, 'shell') }   // registers ctx.shell
  abstract resolve(request: ShellExecRequest): ShellExecSpec
  abstract execute(spec: ShellExecSpec): Promise<ShellExecution>
  // vocabulary types live here too: ShellExecRequest, ShellRunResult, ...
}
```

**Provider** (`packages/shell/bash-local/src/index.ts`):

```ts
export class LocalBashExecutor extends ShellExecutor {
  static inject = ['subprocess']            // consumes another seam
  static Config = z.object({ ... })
  constructor(ctx: Context, readonly config: Config) { super(ctx) }
}
```

**Consumer** (`packages/shell/tool-bash/src/index.ts`):

```ts
export const inject = ['tools', 'shell', 'systemPrompt']
export function apply(ctx, config) {
  // ctx.shell.* — typed via declaration merging, zero knowledge of which
  // provider is mounted (bash-local, bash-sandbox, pwsh-local, remote...)
}
```

## API mechanics (`vendor/cordis/src/{service,reflect,registry,fiber}.ts`)

- `super(ctx, '<key>')` inside a `Service` subclass immediately calls
  `ctx.provide('<key>', this)` — the instance becomes `ctx.<key>`. Duplicate
  registration of the same key throws.
- Consumers: `export const inject = ['key']` (required — plugin stays PENDING
  until provided), `ctx.get('key')` (optional), or
  `ctx.inject(['key'], cb)` (come-and-go: cb re-runs as the service appears /
  disappears, and its effects unroll).
- Reading an uninjected `ctx.<key>` throws at runtime — the proxy enforces
  explicit dependencies.
- Registries (`ctx.tools`, `ctx.llm`) are concrete Services with `registerXxx()`
  methods returning disposers; providers call them inside `ctx.effect`.

## Package dependency discipline (the part everyone gets wrong)

| Dependency | Where it goes |
| --- | --- |
| Stateful dsh packages whose instances must be shared with the host (`dsh-shell`, `dsh-tools`, `dsubprocess`, `dsh-llm`, ...) | `peerDependencies` **and** `devDependencies`, same range |
| Stateless dsh utilities (`dsh-brand`, `dsh-util-values`, `dsh-timeout`) | `dependencies` |
| Third-party packages with independent versions | `dependencies` |
| `@deepseek-ai/cordis` | `peerDependencies` + `devDependencies`, same range (always) |

A `dependencies` copy of a stateful dsh package yields a **second instance** —
the classic bug where a plugin mutates state nobody else sees. The peer
placeholder triggers dsh's runtime resolution to substitute the running
installation's copy; the devDependency copy serves only your type checker and
standalone tests.

Consumers import **only** Definition packages (types, vocabulary, pure
helpers). Never import a Provider package outside tests and composition files.

## In-repo packages (you contribute to the dsh monorepo)

Follow `docs/cookbook/adding-a-package.md`; the skeleton:

1. `packages/<group>/<pkg>/` with `package.json` (copy `packages/core/tools`'s:
   `private: true`, version synced with root, `type: module`,
   `main: lib/index.js`, `exports["."]` → lib, cordis in peer+dev,
   `files` whitelist) and `tsconfig.json` (extends `tsconfig.base.json`).
2. Register the package in `tsconfig.host.json` **or** `tsconfig.client.json`
   references; root workspaces/globs pick up the rest.
3. `src/index.ts` — service packages default-export the service class; function
   plugins use named exports (`name`, `inject`, `apply`, `Config`). Never mix.
4. Display metadata: `locale/en.json` + `locale/zh.json`
   (`meta.title`/`meta.description`), optional top-level `icon` (SVG/PNG/JPEG/
   WebP ≤ 256 KiB), `exports["./package.json"]` + `exports["./locale/*.json"]`.
5. Tests: package unit tests in `tests/*.spec.ts` plus a REAL-composition test
   (see [testing.md](testing.md)); product-visible plugins require it.
6. Verify: `pnpm install && pnpm run doc-sync && pnpm run constraints &&
   pnpm run typecheck && pnpm run lint && pnpm run build && pnpm run hygiene`.

Naming roles (from the cookbook): Controller (routes calls), Store (state),
Registry (multi-provider seams), Runtime (lifecycle), and so on — read the
cookbook table before inventing suffixes.

## LLM adapters

Model providers are a special provider family: subclass the adapter seam and
register on `ctx.llm` via `ctx.llm.registerAdapter([provider], adapter)` (the
registration handle supports atomic `replace` — used for hot credential
updates). Reference implementations: `packages/llm/llm-deepseek`,
`packages/llm/llm-pi-ai`; guide: `docs/cookbook/adding-an-llm-adapter.md`.
