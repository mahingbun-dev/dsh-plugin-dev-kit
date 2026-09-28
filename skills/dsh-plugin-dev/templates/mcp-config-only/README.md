# MCP config-only bundle template · MCP 纯配置模板

Connect an MCP server to dsh with **zero code** — two files.

用**零代码**把 MCP 服务器接入 dsh——两个文件。

## Steps · 步骤

1. Edit `cordis.patch.yml`: set your `serverName`, `transport`, `url`.
   编辑 `cordis.patch.yml`：填你的 `serverName`、`transport`、`url`。
2. Rename package `name` / row `id` if installing more than one.
   装多个时改掉包 `name` / 行 `id`。
3. Install and verify:
   安装并验证：

```sh
dsh plugin --profile demo add ./demo-mcp
dsh --profile demo --dump-config
```

## Notes · 要点

- `failOnStartupError: true` makes a broken URL fail loudly at boot (recommended).
  `failOnStartupError: true` 让坏地址在启动时响亮失败（推荐）。
- Transport/config fields evolve — query the installed schema:
  字段随版本演进——查询已装 schema：
  `Config.listConfigs` → filter `dsh-mcp-client` (or `cordis_inspect_query`).
- This same two-row pattern enables any shipped-but-disabled dsh plugin:
  override its row with `disabled: false` and insert the Host rows it needs.
  同样的两行模式可以启用任何默认禁用的官方插件：覆盖其行为 `disabled: false` 并插入所需 Host 行。
