# UI plugin template · UI 插件模板

Four-file starting point for a widget rendered in the Harness Web UI
(origin: the dsh product's own `cordis-plugin-development` skill template).

四文件的 Web UI 部件起点（源自 dsh 产品内置 `cordis-plugin-development` skill 的模板）。

## Files · 文件

| File | Role · 角色 |
| --- | --- |
| `package.json` | declares `dsh.bundle` + `dsh.client`（两半的接线） |
| `cordis.patch.yml` | Host half row · Host 半的插件行 |
| `index.js` | Host half (empty apply) · Host 半 |
| `client.js` | Client module: registers into a slot · 客户端模块：注册进 slot |

## Steps · 步骤

1. Rename `@local/my-decoration` / `my-decoration` everywhere (package name,
   loader `id`, patch row, slot registration id).
   全局改名：包名、加载器 `id`、patch 行、slot 注册 id。
2. Pick a real slot: query `Slots.listSubTree` with `cordis_inspect_query`
   inside a running Harness — do not guess slot names.
   选真实 slot：在运行中的 Harness 里用 `cordis_inspect_query` 查 `Slots.listSubTree`——不要猜。
3. Use theme tokens for colors/spacing; check light AND dark themes.
   颜色/间距只用主题 token；亮暗两主题都要检查。
4. Install: `dsh plugin --profile demo add ./my-decoration`, then the connected
   page is your first preview — no mock shells.
   安装后连接页面就是首个预览——不做 mock 壳。

Deep guide: `skills/dsh-plugin-dev/references/ui-and-mcp.md`（中文镜像 `zh/ui-and-mcp.zh.md`）。
