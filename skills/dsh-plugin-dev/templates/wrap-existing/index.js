/**
 * @local/my-app-bridge — wrap an existing HTTP API so the dsh agent can call it.
 * Rename: package name / patch row name+id / `export const name` / tool names.
 * Your existing project does not change at all — this shell calls it.
 *
 * Design note: prefer TWO crisp tools over one god-tool that forwards a free
 * `path` — the model cannot build a wrong URL, and each description can teach
 * one operation. Use a free-path tool only for locked-down internal APIs.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

export const name = 'my-app-bridge'

/** Users point the plugin at their instance from the patch row's `config`,
 * e.g. `config: { baseUrl: 'http://127.0.0.1:9000' }`. */
export const Config = z.object({
  baseUrl: z.string().default('http://127.0.0.1:8080'),
  timeoutMs: z.number().default(10_000),
})

export const inject = ['tools']

export function apply(ctx, config) {
  ctx.tools.register(defineTool({
    name: 'myapp_list_items',
    description: "List the items in the user's MyApp service. Use to see what exists.",
    parameters: {},
    output: {
      // additionalProperties must be explicit — a bare { type: 'object' } is rejected.
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(_args, exec) {
      return requestJson(config, '/api/items', exec)
    },
  }))
  ctx.tools.register(defineTool({
    name: 'myapp_get_item',
    description: "Fetch one item by id from the user's MyApp service.",
    parameters: {
      id: { type: 'string', required: true, description: 'Item id, e.g. "42".' },
    },
    output: {
      // additionalProperties must be explicit — a bare { type: 'object' } is rejected.
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      return requestJson(config, `/api/items/${encodeURIComponent(args.id)}`, exec)
    },
  }))
}

/** Shared request helper. Expected errors come back as data the model can
 * read — never thrown. Cancellation (`exec.signal`) and the configured
 * timeout are combined, whichever fires first. */
async function requestJson(config, path, exec) {
  const timeout = AbortSignal.timeout(config.timeoutMs)
  const signal = exec?.signal ? AbortSignal.any([exec.signal, timeout]) : timeout
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      headers: { accept: 'application/json' },
      signal,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return { error: `HTTP ${response.status}`, detail: body }
    return body
  } catch (error) {
    return { error: `request failed: ${String(error)}` }
  }
}
