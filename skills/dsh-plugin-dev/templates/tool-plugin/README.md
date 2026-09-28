# Tool plugin template · 工具插件模板

Minimal model-facing tool plugin for DeepSeek Harness (dsh) — zero build step,
plain ESM JavaScript.

dsh 最小工具插件模板——纯 ESM JavaScript，零构建。

## Rename checklist · 改名清单

1. `package.json` → `name`（本模板 `@local/my-tool`）
2. `cordis.patch.yml` → row `name`（必须等于包名）与 `id`（profile 内唯一）
3. `index.js` → `export const name`、工具 `name`、`description`

## Install & verify · 安装与验证

```sh
node --check index.js
dsh plugin --profile demo add ./my-tool
dsh --profile demo --dump-config        # 必须看到 "# == @local/my-tool" 层
```

Then boot and ask the agent to call `my_tool_hello`.

然后启动并让 agent 调用 `my_tool_hello`。

## Customize · 定制

- Real tool logic → `execute`; options → `Config` schema + patch row `config`.
- Deep guide: `skills/dsh-plugin-dev/references/tool-plugin.md`（中文：`references` 对应 `zh/tool-plugin.zh.md`）。

## Dependencies note · 依赖说明

`peerDependencies` + `devDependencies`（同 range）是有状态 dsh 包的唯一正确写法：
运行时经 dsh 运行时解析共享宿主副本，profile 安装不需要访问任何 registry。
`devDependencies` 只在你想在插件目录里跑 `pnpm install`（IDE/类型检查）时才需要安装。
