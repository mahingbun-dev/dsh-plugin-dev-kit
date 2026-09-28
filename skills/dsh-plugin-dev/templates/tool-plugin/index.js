/**
 * @local/my-tool — minimal dsh tool plugin (host half).
 * Rename every `my-tool` / `@local/my-tool` occurrence (package name, patch
 * row, id) to your own before installing.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-tool'

/** Options arrive from the patch row's `config`, validated by this schema.
 * Uncomment and add `config: { greeting: 'Hi' }` to the patch row to try it.
 */
// import z from '@deepseek-ai/schemastery'
// export const Config = z.object({ greeting: z.string().default('Hello') })

export const inject = ['tools']

export function apply(ctx /* , config */) {
  ctx.tools.register(defineTool({
    name: 'my_tool_hello',
    description: 'Echo a greeting back. Replace this with your real tool.',
    parameters: {
      target: { type: 'string', required: true, description: 'Who to greet.' },
    },
    // `output` is REQUIRED by ctx.tools.register: `schema` validates every
    // returned value; `render` produces the content blocks the model and UI see.
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args /* , exec */) {
      // Return a plain JSON value matching `output.schema` — it becomes the
      // durable tool/result. Long work: respect `exec.signal`; expected
      // errors: return { error: ... } data instead of throwing.
      return { message: `Hello, ${args.target}!` }
    },
  }))
}
