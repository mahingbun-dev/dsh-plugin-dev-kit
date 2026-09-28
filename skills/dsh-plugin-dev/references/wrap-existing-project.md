# Wrapping an existing project into dsh

The user has a working app/API/CLI and wants the dsh agent to use it. Do not
rewrite their project — put a thin plugin shell around it. Four strategies,
pick by what the project already exposes:

| Existing project exposes | Strategy | Code needed |
| --- | --- | --- |
| HTTP / REST API | **HTTP bridge tool** (template `wrap-existing`) | one small tool plugin |
| MCP server (or can add one cheaply — many frameworks do) | **Config-only MCP bundle** (template `mcp-config-only`) | zero code |
| CLI / script / long-running process | **Subprocess bridge tool** | tool plugin + `ctx.subprocess` |
| Node library usable in-process | **Library-import tool** | tool plugin importing their package |

## HTTP bridge (the default answer)

`templates/wrap-existing/` gives the whole skeleton:

1. A tool plugin whose `execute` calls the existing service over HTTP
   (`fetch(base + path)`), with `Config` declaring `baseUrl`/`timeout` so users
   point it at their instance without touching code:

   ```js
   import z from '@deepseek-ai/schemastery'
   export const Config = z.object({
     baseUrl: z.string().default('http://127.0.0.1:8080'),
     timeoutMs: z.number().default(10_000),
   })
   ```

2. Tool description written for the model: say what the wrapped system is and
   when to call it; keep `parameters` minimal and typed.
3. Map their API errors into the returned JSON value (`{ error: '...' }`) —
   the model reads the tool result; do not throw for expected business errors.
4. Respect cancellation: pass an `AbortSignal` from `exec.signal` into `fetch`.

Auth rule: config carries credential **references** (env var names, e.g.
`z.string().role('credential-ref')`), and `execute` resolves the value per call
from the environment — never a secret value in `package.json`, patch, or log.

## Config-only MCP bundle (zero code)

If the project speaks MCP (or the team already runs an MCP server), no plugin
code is needed at all — a two-file bundle inserts a configured
`dsh-mcp-client` row (see `templates/mcp-config-only/` and
[ui-and-mcp.md](ui-and-mcp.md)). Prefer this when it fits: it is upgrade-proof
and needs no build step.

## Subprocess bridge

For CLIs and local daemons, consume the `subprocess` seam so spawning goes
through dsh's process management (and any sandbox policy the user has):

```js
export const inject = ['tools', 'subprocess']
export function apply(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'myapp_query',
    // ...
    async execute(args, exec) {
      const proc = ctx.subprocess.spawn(['node', config.cliPath, JSON.stringify(args)], {
        signal: exec.signal,
      })
      // collect stdout, return parsed JSON
    },
  }))
}
```

Check the exact `spawn` signature in the installed `dsh-subprocess` `.d.ts`
(pre-stable API). For long-running companions, register a job on `ctx.jobs`
instead of blocking inside `execute` — the model gets completion as an
in-session notice rather than a stalled tool call.

## Library import

If the project is an npm package that is safe to load in the Harness process,
list it under `dependencies` (it is third-party, independent versioning) and
call it from `execute`. Keep it out of `peerDependencies` — only dsh packages
whose instances must be shared with the host go there (see
[seam-provider.md](seam-provider.md) § dependency discipline).

## Checklist before you ship a wrapper

- [ ] Tool `description` explains the wrapped system from the model's view.
- [ ] `parameters` cover the few operations the agent actually needs (expose
      three crisp tools rather than one god-tool mirroring the whole API).
- [ ] Config has defaults that work against `localhost` so first boot succeeds.
- [ ] Errors returned as data; cancellation honored via `exec.signal`.
- [ ] Secrets only as env references; nothing sensitive in `files` or logs.
- [ ] `dsh --profile demo --dump-config` shows the row; a live boot calls the
      real service once end-to-end (see [testing.md](testing.md)).
