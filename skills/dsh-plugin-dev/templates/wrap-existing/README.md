# Wrap-existing template · 套壳接入模板

Make an **existing HTTP service** callable by the dsh agent without touching
that project. 让 dsh agent 能调用**既有 HTTP 服务**，原项目零改动。

## Variants · 策略选择

| Your project exposes · 项目暴露 | Use · 用法 |
| --- | --- |
| HTTP/REST API | this template (fetch bridge) · 本模板 |
| MCP server | `templates/mcp-config-only/`（零代码） |
| CLI / long-running process | this shape + `ctx.subprocess`（见 references） |
| Node library | this shape + import their package |

## Steps · 步骤

1. Start your service on `127.0.0.1:8080` (or set `config.baseUrl` in the
   patch row). 让服务跑在 8080（或在 patch 行 config 里指 baseUrl）。
2. Rename package/rows/tool (`myapp_query` → your domain). 改名。
3. Sharpen `description` + `parameters` to the few operations the agent needs
   — 3 crisp tools beat 1 god-tool. 把 description/parameters 磨到 agent 真正需要的少数操作——三个小工具胜过一个巨无霸。
4. Install & verify:
   ```sh
   node --check index.js
   dsh plugin --profile demo add ./my-app-bridge
   dsh --profile demo --dump-config
   ```

## Rules · 规则

- Secrets: config carries env-var **references** (`z.string().role('credential-ref')`);
  resolve per call. config 只放环境变量引用，逐次解析。
- Errors return as data; cancellation flows through `exec.signal`.
  错误以数据返回；取消经 `exec.signal` 传递。

Deep guide: `skills/dsh-plugin-dev/references/wrap-existing-project.md`（中文镜像 `zh/wrap-existing-project.zh.md`）。
