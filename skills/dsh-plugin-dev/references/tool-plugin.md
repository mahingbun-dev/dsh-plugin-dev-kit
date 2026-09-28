# Tool plugins: the model-facing capability

The most common plugin: register a tool the agent can call. Verified against
`packages/core/tools` and `packages/fs/tool-fs/src/read.ts` at dsh `0.1.7-rc.x`.

## Minimal shape (out-of-tree, zero build step)

```js
// index.js
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-weather-tool'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'get_weather',
    description: 'Get the current weather for a city.',
    parameters: {
      city: { type: 'string', required: true, description: 'City name, e.g. Shanghai.' },
      unit: { type: 'string', description: "'c' or 'f'. Defaults to 'c'." },
    },
    async execute(args) {
      // return a plain JSON value; it becomes the durable tool/result
      return { city: args.city, tempC: 23, summary: 'sunny' }
    },
  }))
}
```

The patch row that mounts it (see `templates/tool-plugin/`):

```yaml
- insert:
    - id: my-weather-tool
      name: '@local/my-weather-tool'
```

## The `defineTool` contract

- `name` — the model-visible tool name. Global registry; pick a unique,
  lowercase_snake name. (`run_code` is reserved for PTC.)
- `description` — model-visible. One or two concrete sentences; the agent
  chooses tools by this.
- `parameters` — shorthand schema DSL, one entry per argument:
  `{ type: 'string' | 'number' | ..., required?: true, description }`. A tool
  with no arguments declares `parameters: {}` (the shape production tools use,
  e.g. `packages/jobs/tool-jobs`). Only name/description/parameters ever reach
  the model; `schemas()` whitelists exactly those three fields — never put
  secrets or prose for humans here.
- `execute(args, exec)` — async, returns a canonical JSON value matching
  `output.schema`; the value becomes the durable `tool/result` event
  (model-visible ⟺ logged for free). Respect `exec.signal` for cancellation in
  long work; return expected errors as data (`{ error: ... }`), not throws.
- `output` — **required**; `ctx.tools.register` throws without it. Two parts:
  - `schema` — JSON-schema DSL validating every returned value (same style as
    the parameter spec: `{ type, required? }` per property, `items`, ...).
    `additionalProperties` must be explicitly `true` or `false` on objects — a
    bare `{ type: 'object' }` is rejected.
  - `render(args, value)` — pure; returns the content blocks (`[{ type:
    'text', text }`, images]) the model and UI/replay see. The raw value is
    validated and persisted, but only render output reaches the model.
  - `presentationMeta(args, value)` (optional) — persisted metadata so UI
    cards survive replay when the raw value is unavailable.
- `isConcurrencySafe` (optional) — hint for parallel dispatch.

## Registry behavior worth knowing

- `ctx.tools.register(definition)` returns the unregister disposer. The
  registry is `ctx.tools` (inject `['tools']`); it needs `systemPrompt`, which
  `dsh-base` always provides — do not inject `systemPrompt` yourself unless you
  contribute prompt sections.
- **Effect semantics**: `ctx.effect(body)` runs `body` immediately and hands
  every disposer it produces (including each `yield` of a generator body) to
  your plugin's fiber — you do **not** need to return anything from `apply`.
  The plugin body's own return value is also collected as an effect, so
  `return ctx.effect(...)` from `apply` is harmless but redundant. Multi-tool
  plugins that want ordered teardown use one
  `ctx.effect(function* () { yield registerA(); yield registerB() })`.
- Global vs scoped: registering on `ctx` is global; registering on an agent's
  scope (`agent.ctx.tools.register`) shadows the global tool for that agent.
- Prompt guidance: tools commonly add a prompt section telling the model when
  to prefer the tool (`ctx.systemPrompt.addSection(...)` with
  `ctx.tools.get(name, scope)` presence check — see `tool-fs/src/read.ts`).
- Policy interception: `tools/pre-execute` (waterfall) can allow/deny/ask
  approval before your `execute` runs; `tools/execute` wraps execution (timeouts);
  `tools/post-execute` can replace results. Your tool stays policy-free; policies
  are other plugins' listeners.

## Config

Export a Schemastery schema to accept row `config`:

```js
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  endpoint: z.string().default('https://api.example.com'),
  apiKeyEnv: z.string().role('credential-ref').default('MY_API_KEY').volatile(),
})
```

- `.volatile()` fields hot-update in place without remounting the plugin;
  normal field changes remount.
- Credential **references** (env var names) go in config; resolve values per
  operation via `ctx.credentials` — never store secret values in config.
- Query an installed plugin's effective schema with `Config.listConfigs`.

## Common variations

- **Multiple related tools**: one plugin, several `ctx.tools.register` calls —
  one disposer each, ideally inside one `ctx.effect(function* () { yield ... })`.
- **Long-running work**: return quickly and register progress via `ctx.jobs`
  (the model polls or gets an in-session notice), or use
  `run_in_background`-style tool options if available in your baseline.
- **Needs another service**: add it to `inject` (`['tools', 'shell']`), or use
  `ctx.get('approval')` for optional services, `ctx.inject(['jobs'], cb)` for
  come-and-go dependencies.
