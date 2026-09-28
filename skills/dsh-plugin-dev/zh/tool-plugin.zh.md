# 工具插件：模型可见的能力

> [tool-plugin.md](../references/tool-plugin.md) 的中文镜像。已对 `packages/core/tools` 与 `packages/fs/tool-fs/src/read.ts` 核实（dsh `0.1.7-rc.x`）。

## 最小形态（外部插件，零构建）

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
      // 返回纯 JSON 值；它成为持久化的 tool/result
      return { city: args.city, tempC: 23, summary: 'sunny' }
    },
  }))
}
```

挂载它的 patch 行（完整模板见 `templates/tool-plugin/`）：

```yaml
- insert:
    - id: my-weather-tool
      name: '@local/my-weather-tool'
```

## `defineTool` 契约

- `name`：模型可见的工具名。全局注册表；取唯一的小写蛇形名（`run_code` 保留给 PTC）。
- `description`：模型可见。一两句具体描述——agent 靠它选择工具。
- `parameters`：简写 schema DSL，每个参数一项：`{ type: 'string' | 'number' | ..., required?: true, description }`。**只有 name/description/parameters 会发给模型**（`schemas()` 白名单）；不要在这里放机密或给人看的说明。
- `execute(args, exec)`：异步，返回符合 `output.schema` 的 canonical JSON 值；该值成为持久化 `tool/result` 事件（自动满足 model-visible ⟺ logged）。长任务要尊重 `exec.signal` 取消；预期内错误以数据返回（`{ error: ... }`），不要 throw。
- `output`——**必填**，缺了 `ctx.tools.register` 直接抛错。两部分：
  - `schema`：校验每次返回值的 JSON-schema DSL（与参数同风格：每属性 `{ type, required? }`、`items` 等）。对象上的 `additionalProperties` 必须显式写 `true` 或 `false`——裸 `{ type: 'object' }` 会被拒绝。
  - `render(args, value)`：纯函数；产出模型与 UI/回放看到的内容块（`[{ type: 'text', text }`、图片]）。原始值被校验并持久化，但只有 render 的输出到达模型。
  - `presentationMeta(args, value)`（可选）：持久化卡片元数据使其在回放中可恢复。
- `isConcurrencySafe`（可选）：并行派发提示。

## 注册表行为须知

- `ctx.tools.register(definition)` 返回注销 disposer。registry 是 `ctx.tools`（inject `['tools']`）；它自己需要 `systemPrompt`（`dsh-base` 恒有）——除非你也贡献提示词段落，否则不要自己 inject `systemPrompt`。
- 全局 vs 作用域：注册在 `ctx` 上是全局；注册在 agent 作用域（`agent.ctx.tools.register`）对该 agent 遮蔽全局。
- 提示词引导：工具常加一段提示词告诉模型何时优先用它（`ctx.systemPrompt.addSection(...)`，配合 `ctx.tools.get(name, scope)` 存在性检查——见 `tool-fs/src/read.ts`）。
- 策略拦截：`tools/pre-execute`（waterfall）可在你的 `execute` 前允许/拒绝/请求审批；`tools/execute` 包裹执行（超时）；`tools/post-execute` 可替换结果。工具本身保持无策略；策略是别的插件的监听器。

## Config

导出 Schemastery schema 即可接收 patch 行 `config`：

```js
import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  endpoint: z.string().default('https://api.example.com'),
  apiKeyEnv: z.string().role('credential-ref').default('MY_API_KEY').volatile(),
})
```

- `.volatile()` 字段原地热更新不重挂插件；普通字段变更走重挂。
- config 里放凭据**引用**（环境变量名）；每次操作经 `ctx.credentials` 解析值——绝不在 config 存密文。
- 已装插件生效的 schema 用 `Config.listConfigs` 查询。

## 常见变体

- **多个相关工具**：一个插件多次 `ctx.tools.register`——每个都要 disposer，最好放进一个 `ctx.effect(function* () { yield ... })` 保持清理有序。
- **长任务**：快速返回，用 `ctx.jobs` 登记进度（模型轮询或收到会话内通知）。
- **需要别的服务**：加进 `inject`（`['tools', 'shell']`）；可选服务用 `ctx.get('approval')`；随来随走用 `ctx.inject(['jobs'], cb)`。
