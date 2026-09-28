# UI 插件与 MCP bundle

> [ui-and-mcp.md](../references/ui-and-mcp.md) 的中文镜像。

## UI 插件（Harness Web UI）

UI 插件在同一包内有两半：Host 半（普通插件，常为空 `apply`）与浏览器经 Client 模块加载器加载的 **Client 模块**。manifest 把两者接起来：

```json
{
  "exports": { ".": "./index.js", "./client": "./client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": ["@deepseek-ai/dsh-client-ui-conversation"]
    }
  }
}
```

- `exports["./client"]` 与 `dsh.client` 必须同有同无（in-repo 有配置门禁强制）。
- `inject` 列出你要用其 slots/props 的客户端包——它们加上共享平台基座（React、Cordis、静态 UI 库）成为 Client 模块内 `require()` 可得的模块。

Client 模块经模块加载器注册进浏览器的 Cordis 树（完整文件见 `templates/ui-plugin/client.js`）：

```js
window.__ModuleLoader__.load({
  id: '@local/my-decoration',           // 必须与包名一致
  factory(require) {
    const React = require('react')
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'my-decoration', order: 5,
        }, MyComponent))
      },
    }
  },
})
```

让 UI 插件受欢迎的规则：

- 选 slot 前先用 `cordis_inspect_query`（`Slots.listSubTree`）查可用 slots；颜色/间距只用主题 token——不硬编码色板；亮色暗色主题都要可读。
- 不要 import 超出 `dsh.client.inject` 声明范围的 Harness 客户端包。
- **已安装插件在连接页面里的渲染**就是首个预览。安装前不做 mock HTML 壳、预览服务器或截图装置；没有浏览器控制能力时明确说明验证边界（安装 + slot 注册成功 ≠ 像素级证明）。
- 替换已安装的客户端代码需要重启才能加载新模块世代；不要凭 slot id 未变推断浏览器代码已更新。

## MCP bundle（纯配置，零代码）

两文件接一个 MCP 服务器；插件行配置 `dsh-mcp-client`：

`package.json`

```json
{
  "name": "@local/demo-mcp",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

`cordis.patch.yml`

```yaml
- insert:
    - id: demo-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: demo
        transport: streamable-http
        url: http://127.0.0.1:3000/mcp
        failOnStartupError: true
```

- `failOnStartupError: true` 让配置错误在启动时响亮失败（dsh 的方式）；仅在服务器可选时设 `false`。
- transport 选项随基线演进——用 `Config.listConfigs` 查已装 `dsh-mcp-client` 的 schema，别猜。
- 该模式可推广：**任何默认禁用的官方插件都能用两行 bundle 启用**——覆盖其行（`disabled: false`）并插入其依赖的 Host 行。行的 id 与原因见源码 checkout 的 `packages/bundle/*/cordis.patch.yml`。

## 显示元数据与图标（各类 bundle 通用）

Plugin Manager 卡片与 Settings 清单读取：

- `locale/en.json`（+ `locale/zh.json`）：`{ "meta": { "title": "...", "description": "..." } }`
- `package.json`：顶层 `icon`（相对路径；SVG/PNG/JPEG/WebP ≤ 256 KiB；拒绝绝对路径/URL/符号链接逃逸），加 `exports["./package.json"]`、`exports["./locale/*.json"]`、`files: ["locale/*.json", "icon.svg"]`。

缺字段回退到包 `name`/`description` 与默认图；坏元数据产出诊断并保留有效文本。
