# 红线清单：每条都有为什么与修法

> [pitfalls.md](../references/pitfalls.md) 的中文镜像。这些都是真实坑过人的错误。每条：症状 → 原因 → 修法。

## P1 · 没有 `dsh.bundle` 的包装了但永不激活

- 症状：`dsh plugin add` 成功、`list_plugins` 看得到包、什么都没加载；`--dump-config` 无行。
- 原因：该包只是普通依赖——只有 manifest 声明 `dsh.bundle.patch` 的包才贡献 patch 层（plugin-manager 会打 warning）。
- 修法：加 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 与 patch 文件，至少一条 `insert` 行且 `name` 为包名。

## P2 · 有状态 dsh 依赖写进 `dependencies` → 第二实例

- 症状：插件改的状态（registry/store/缓存）别的插件看不见；或工具重名/事件双发。
- 原因：pnpm 装了有状态 dsh 包的物理副本而不是共享宿主实例。
- 修法：移到 `peerDependencies` + `devDependencies`（同 range）。peer 经 dsh 运行时解析替换为运行中安装的副本；dev 副本只服务类型检查/测试。

## P3 · git 安装失败或加载旧代码

- 症状：首次 `dsh plugin add github:you/pkg` 报构建/许可错误；或 TS 包加载不到东西（缺 `lib/`）。
- 原因：git 装的是**源码**；pnpm ≥10 在白名单前拒绝跑 `prepare`。
- 修法（作者）：自带自包含 `prepare` 脚本，不依赖 monorepo 上下文。修法（用户）：把 pnpm 打印的准确 key 抄进 profile `pnpm-workspace.yaml` 的 `allowBuilds: { "pkg": true }` 再重试。把该许可视为在安装时执行作者代码；钉住 commit（`github:you/pkg#<sha>`）。彻底回避：发 npm 或 tarball（`pnpm pack`）——都无需构建许可。

## P4 · patch 覆盖丢了 config 键

- 症状：覆盖行之后目标插件表现为默认行为。
- 原因：patch **整行替换** `config`，从不深合并。
- 修法：重写该行需要的每个键（从 `--dump-config` 抄行再改值）。覆盖官方行同理。

## P5 · 手改 profile 文件

- 症状：profile 损坏、锁竞争、改动被悄悄回滚。
- 原因：`dsh plugin` 带锁 + 对账地独占管理 profile 的 `package.json`、`pnpm-lock.yaml`、`cordis.patch.yml`、`pnpm-workspace.yaml`。
- 修法：安装/卸载走 `dsh plugin --profile <name> add/remove`；启停走插件管理器（Web UI 或 `plugin_manager` 工具，它替你写覆盖行的 `disabled`）。绝不在 `$DSH_HOME` 下建包；绝不在 profile 目录跑 pnpm。

## P6 · 混用导出形态

- 症状：`apply` 永不执行。
- 原因：模块同时导出 default（类）与命名函数插件导出；Loader 丢弃函数插件命名空间。
- 修法：一模块一形态。函数插件：`export const name` / `inject` / `apply`。服务：只默认导出类。

## P7 · 注册没有 disposer

- 症状：HMR 或禁用后，旧世代的工具/监听还活着；事件重复。
- 原因：注册绕开了 `ctx.effect`/registry `register()`（模块顶层副作用是经典案例）。
- 修法：注册全部在 `apply` 内、经返回 disposer 的 API；多步 setup 用一个 `ctx.effect(function* () { ... yield cleanup })` 保证清理有序。

## P8 · 缺 `@deepseek-ai/cordis` peer 声明

- 修法：每个插件包都把 `@deepseek-ai/cordis` 放进 `peerDependencies` **和** `devDependencies`，同 range。

## P9 · 静态 manifest 字段用 `!!js`

- 症状：配置门禁/Loader 拒绝 patch。
- 原因：只有 `disabled` 允许表达式；`id`、`name`、`inject`、`intercept`、`isolate` 与 `config` 静态字段必须是字面量。
- 修法：计算值走注入服务（`inject: [myStartup]` 然后 `config: { port: !!js ctx.myStartup.port ?? 8080 }` 是 CLI 驱动值的正规姿势）。

## P10 · UI 插件不可见或崩溃

- 原因：slot 名不对（先查 `Slots.listSubTree`）、硬编码颜色破坏暗色主题、import 了未在 `dsh.client.inject` 声明的客户端包、`exports["./client"]` 与 `dsh.client` 不一致。
- 修法：按 [ui-and-mcp.zh.md](ui-and-mcp.zh.md) 来；在连接页面亮/暗两主题各验一次；替换已装代码后重启加载新模块。

## P11 · 机密放错位置

- 修法：config 只放**引用**（`.role('credential-ref')` 的环境变量名）；逐操作解析。绝不提交真实值；绝不在工具输出里打印解析值。

## P12 · 什么都没验证就交付

- 修法：爬 [testing.zh.md](testing.zh.md) 的验证阶梯：`--dump-config` → 启动结果字段 → 一次真实端到端 → 自动化 REAL-composition 测试。如实报告你爬到了哪一级。

## P13 · `inject` 拼错 → 插件静默 PENDING 永不激活

- 症状：包装好了、`--dump-config` 里有行、任何地方都没有报错——插件就是不见。
- 原因：注入列表里有运行中没有任何服务提供的 key（拼错/写错）。注入缺失不报错，插件会一直等依赖出现。
- 修法：在运行中的 Harness 里用 inspect 工具查激活状态（`cordis_inspect_list`），或把 `inject` 列表与 `--dump-config` 的 `ctx.` 键对照。经典：`inject: ['tool']` 写错成 `tools` 的反面。

## P14 · patch 行在，但模块加载失败

- 症状：`--dump-config` 有你的行；启动日志报该行模块解析失败。
- 原因：行的 `name` 解析不到你的包——拼错，或行里写了源码路径而非安装后的包名。
- 修法：行 `name` 必须与包 `name` 完全一致（Node 靠它解析已安装代码）；检查 `files`/`exports` 确实带上了入口模块；git 安装确认 `prepare` 构建过（P3）。

按症状组织的完整诊断树：[troubleshooting.zh.md](troubleshooting.zh.md)。
