/**
 * dsh-dice-tool — a complete, minimal DeepSeek Harness tool plugin.
 *
 * Install:  dsh plugin --profile demo add ./dsh-dice-tool
 * Verify:   dsh --profile demo --dump-config   (a "# == dsh-dice-tool" layer appears)
 * Use:      boot the profile and ask the agent to "roll 2d6".
 *
 * Pure logic lives in `dice.js` (no dsh imports) so tests run without dsh;
 * this entry module adds the plugin wiring.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { rollDice } from './dice.js'

export const name = 'dice-tool'

export { rollDice }

export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'roll_dice',
    description: 'Roll dice and return the individual rolls plus their total.',
    parameters: {
      sides: { type: 'number', description: 'Sides per die (2..1000). Defaults to 6.' },
      count: { type: 'number', description: 'Number of dice (1..20). Defaults to 1.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dice: { type: 'string', required: true },
          rolls: { type: 'array', required: true, items: { type: 'number' } },
          total: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `${value.dice} → ${value.rolls.join(', ')} (total ${value.total})`,
      }],
    },
    async execute(args) {
      const sides = args.sides ?? 6
      const count = Math.min(Math.max(Math.floor(args.count ?? 1), 1), 20)
      const rolls = Array.from({ length: count }, () => rollDice(sides))
      return {
        dice: `${count}d${sides}`,
        rolls,
        total: rolls.reduce((sum, value) => sum + value, 0),
      }
    },
  }))
}
