# 把已有项目套壳接入 dsh

> [wrap-existing-project.md](../references/wrap-existing-project.md) 的中文镜像。用户已有能跑的应用/API/CLI，想让 dsh agent 用上它——不要重写他的项目，给它套一层薄插件壳。按项目已暴露的接口选策略：

| 已有项目暴露 | 策略 | 需要写的代码 |
| --- | --- | --- |
| HTTP / REST API | **HTTP 桥工具**（模板 `wrap-existing`） | 一个小工具插件 |
| MCP 服务器（或能廉价加上——多数框架都行） | **纯配置 MCP bundle**（模板 `mcp-config-only`） | 零代码 |
| CLI / 脚本 / 长驻进程 | **子进程桥工具** | 工具插件 + `ctx.subprocess` |
| 可进程内加载的 Node 库 | **库导入工具** | 导入其包的工具插件 |

## HTTP 桥（默认答案）

`templates/wrap-existing/` 给出完整骨架：

1. 工具插件的 `execute` 调既有服务（`fetch(base + path)`），`Config` 声明 `baseUrl`/`timeout`，用户指到自己的实例、零改码：

   ```js
   import z from '@deepseek-ai/schemastery'
   export const Config = z.object({
     baseUrl: z.string().default('http://127.0.0.1:8080'),
     timeoutMs: z.number().default(10_000),
   })
   ```

2. 工具 `description` 为模型而写：说清被包装的系统是什么、何时该调用；`parameters` 保持少而类型化。
3. 把被包装 API 的错误映射进返回 JSON（`{ error: '...' }`）——模型读的是工具结果；预期内的业务错误不要 throw。
4. 尊重取消：把 `exec.signal` 作为 `AbortSignal` 传进 `fetch`。

鉴权规则：config 携带凭据**引用**（环境变量名，`z.string().role('credential-ref')`），`execute` 每次调用从环境解析值——绝不在 `package.json`、patch 或日志里放密文。

## 纯配置 MCP bundle（零代码）

项目讲 MCP（或团队本来就跑着 MCP server）时完全不写代码——两文件 bundle 插一行配置好的 `dsh-mcp-client`（见 `templates/mcp-config-only/` 与 [ui-and-mcp.zh.md](ui-and-mcp.zh.md)）。能套上就优先用它：升级免疫、零构建。

## 子进程桥

CLI 与本地守护进程走 `subprocess` 接缝，让 spawn 经过 dsh 的进程管理（和用户配置的沙箱策略）：

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
      // 收集 stdout，解析 JSON 返回
    },
  }))
}
```

spawn 的准确签名以已装 `dsh-subprocess` 的 `.d.ts` 为准（API 预稳定）。长驻伴生进程改在 `ctx.jobs` 登记 job，不要在 `execute` 里阻塞——模型以会话内通知拿到完成，而不是卡死的工具调用。

## 库导入

项目是可安全加载进 Harness 进程的 npm 包时，把它列进 `dependencies`（第三方、独立版本），`execute` 里直接调。不要放进 `peerDependencies`——只有需与宿主共享实例的 dsh 包才去那里（见 [seam-provider.zh.md](seam-provider.zh.md) 依赖纪律）。

## 套壳交付前检查单

- [ ] 工具 `description` 从模型视角讲清被包装系统。
- [ ] `parameters` 覆盖 agent 真正需要的少数操作（三个干脆的小工具胜过一个映射全 API 的巨无霸）。
- [ ] Config 默认值对 `localhost` 可用，保证首次启动即成功。
- [ ] 错误以数据返回；经 `exec.signal` 支持取消。
- [ ] 机密只以环境引用出现；`files` 与日志无敏感内容。
- [ ] `dsh --profile demo --dump-config` 看得到该行；真实启动端到端调通一次（见 [testing.zh.md](testing.zh.md)）。
