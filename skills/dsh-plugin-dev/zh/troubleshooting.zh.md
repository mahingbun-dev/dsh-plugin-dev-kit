# 排障：装了但不生效

> [troubleshooting.md](../references/troubleshooting.md) 的中文镜像。按症状诊断。UI 卡片上看起来一样的三种状态其实是三件事：**已安装**（包进了 profile 的 node_modules）、**已启用**（没有覆盖行禁用它）、**已激活**（Fiber 到达 ACTIVE 并完成贡献）。下面的树告诉你断在哪一层。

## 症状 1 · `--dump-config` 里没有我的行

组合层断了——插件从未贡献层。

1. `package.json` 是否声明 `"dsh": { "bundle": { "patch": "..." } }`，文件是否存在？（P1——没有它就是普通依赖。）
2. patch 里是否至少有一条 `- insert:` 行？
3. 安装时是否打过 `dsh.bundle` 相关 warning？先重读安装输出再重跑任何命令。
4. dump 的是不是你装进的那个 profile？`dsh --profile <名> --dump-config`；在 Harness shell 里 `$DSH_PROFILE` 就是它。

## 症状 2 · 行在，插件永不激活（还看不见报错）

1. **被覆盖行禁用**：在插件页面关过它就会往 profile 的 `cordis.patch.yml` 写 `disabled` 行。经插件管理器重新启用，别手改（P5）。
2. **静默 PENDING**（P13）：`inject` 里有运行中不存在的 key。在运行中的 Harness 会话里用 inspect 工具查（`cordis_inspect_list`，再对你的 entry id `cordis_inspect_query`），或把 `inject` 列表与 `--dump-config` 打印的 `ctx.` 键对照。经典错误：`['tool']` 写成 `tools` 的反例。
3. **被覆盖**：更后面的层（profile patch、home patch、`--patch`）有同 `id` 行。换个全 profile 唯一的 id。
4. **`restart-required`**：安装器已提示；重启前改动不生效。先重启再继续排查。

## 症状 3 · 激活了，但工具不在

1. **混合导出形态**（P6）：既有 default 又有命名导出——Loader 丢弃函数插件命名空间，`apply` 根本不跑。
2. 注册写在 `apply` 外（模块顶层）或注册到了 agent 作用域而不是全局 `ctx.tools.register`。
3. 工具 `name` 与现有工具撞名，或用了保留名 `run_code`。
4. `Config` 校验失败——读启动/安装的 `failed` 原因；按 schema（`Config.listConfigs` 可查）修行 `config`。

## 症状 4 · 工具在，模型不调用

1. 到模型的只有 `name` / `description` / `parameters`。description 是否具体说清何时用？parameters 是否符合简写 DSL（`{ type, required?, description }`；无参数写 `{}`）？
2. 加一段提示词说明何时优先用这个工具（`ctx.systemPrompt.addSection`，用 `ctx.tools.get(name, scope)` 做存在性门控）。
3. 你是真机启动验证过，还是默认它该行？爬 [testing.zh.md](testing.zh.md) 的阶梯，REAL-composition 测试能直接看到注册表状态。

## 症状 5 · UI 插件装了，页面没变化

1. 先跑症状 1–2 的树（bundle 的行不激活，Client 模块不挂载）。
2. slot 名不对——用 inspect 工具查在线 slots（`Slots.listSubTree`），不要猜。
3. import 了超出 `dsh.client.inject` 的包，或硬编码颜色破坏主题——见 [ui-and-mcp.zh.md](ui-and-mcp.zh.md)。
4. 替换了已安装的客户端代码但没重启——浏览器要重启后才加载新模块世代。

## 启动结果字段去哪看

- `dsh plugin add` 输出 / `plugin_manager` 工具结果：`application`、`warnings`、`restart-required`、`failed`、`overridden`——下一步由它们决定，不靠感觉。
- `--dump-config`：组合后的行（组合层真相，免 key）。
- headless 启动（`dsh --profile <名>`）会打印启动失败，包括缺必需 entry 的 `StartupError`。
