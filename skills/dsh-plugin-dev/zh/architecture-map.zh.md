# 架构地图：你的插件插在哪里

> [architecture-map.md](../references/architecture-map.md) 的中文镜像，蒸馏自 dsh 架构文档。

## Cordis 五个核心概念

DeepSeek Harness 是构建在 vendored Cordis 框架（`vendor/cordis/`）上的全插件 agent harness，没有特权内核：

1. **插件是实现 Service 的对象**——带可选 `inject`/`Config`/`name` 元数据的函数 `(ctx, config)`、`Service` 子类（默认导出）、或带 `apply(ctx, config)` 的对象。
2. **Context 是服务仓库**：服务占据稳定 `ctx.<key>`（`ctx.sessions`、`ctx.tools`、`ctx.llm`、`ctx.shell`、`ctx.fs`……），其他插件**按键**查找，绝不 import 实现。
3. **依赖用 `inject` 声明**：注入的服务不存在则插件挂起（PENDING），出现即自动激活——加载顺序由需求表达，不靠启动脚本。
4. **类型化事件是通讯总线**：事件名经 declaration merging 强类型化；payload 与分发模式是公共契约的一部分。
5. **注册即可逆效应**：一切贡献经 `ctx.effect()` / `ctx.on()` / registry `register()` 安装并返回 disposer，卸载逆序回滚。

## 事件五种分发模式

| 方法 | await | 顺序 | 返回值 | 用途 |
| --- | --- | --- | --- | --- |
| `ctx.emit` | 否 | 注册序 | 无 | 通知/观察（`session/event`、`agent/status`） |
| `ctx.parallel` | 是 | 并发 allSettled | AggregateError | 扇出（`session/flush`） |
| `ctx.serial` | 是 | 顺序 await | 有 | 有序阶段（`agent/created`、`agent/turn-stopping`） |
| `ctx.bail` | 否 | 直到有人 bail | 有 | 同步决策 |
| `ctx.waterfall` | 否 | 洋葱中间件 | 有 | 策略拦截（`agent/pre-step`、`agent/request`、`tools/*`、`llm/stream`） |

**waterfall 语义**：监听器收到 `(...args, next)`；调 `next()` 委托给下一个监听器、最终落到派发方内置行为；不调 `next()` 即否决整条链。返回值取最外层监听器的返回值。协作型监听器通常改写共享的请求/决策对象后委托。

**作用域派发**：注册在 agent 作用域上的监听器（`this: Scoped<Agent>` 标注）只收到该 agent 及其子孙的事件——一个进程、一条总线，靠 Context 过滤隔离。

## 能力接缝

接缝是可替换能力，三角色：

- **Service Definition**：拥有 `ctx.<key>` 与词汇类型的 Cordis `Service`（抽象类如 `ShellExecutor`，或具体 registry 如 `LlmRuntime`），绝不是裸 TS interface。
- **Service Provider**：实现它（`extends ShellExecutor`，或调 `ctx.llm.registerAdapter(...)`）。
- **Consumer**：注入按键，调 `ctx.<key>` 方法。

经典示例：`dsh-shell`（Definition）/ `dsh-bash-local`、`dsh-bash-sandbox`、`dsh-pwsh-local`（Provider）/ `dsh-tool-bash`（Consumer）。把 fs + subprocess 指向远端沙箱，Bash、PTY、LSP 一起迁移——Consumer 零改动。全量接缝注册表见 dsh 仓库 `docs/capability-seams.md`（30+）。

## 组合：profile、bundle、patch

运行中的 `dsh` 是按层叠序组合出的插件树：

1. profile `dsh.profile.bundles` 列出的各 bundle patch，按列表序（`@deepseek-ai/dsh-base` 是共享第一层）；
2. profile 自己的 `cordis.patch.yml`；
3. home 级 `$DSH_HOME/cordis.patch.yml`；
4. 各 `--patch <path>` overlay，按 argv 序。

后层按 `id` 逐行胜出，**整行替换 `config`**（不深合并）。`--dump-config` 打印组合结果；它打印的任何行都可以被更后的 patch 覆盖。

## 轮次：你的工具插在哪

一个 **step** = 一次模型请求 + 它调用的工具；一个 **turn** = 零或多个 step。每 step：`agent/pre-step`（waterfall，认领/改写输入）→ 组装提示词段落 + 工具 schema → 请求**从 session 日志派生**（`deriveMessages()`；运行时不变量强制 请求 == 日志投影）→ `ctx.llm.stream` → 工具调用经 `tools/pre-execute`（审批，fail-closed）→ `tools/execute` → `tools/post-execute` → `tool/result` 入日志 → 循环或结束。

Model-visible ⟺ logged：凡到达模型请求的内容必须能从追加式 session 日志重建。你的工具从 `execute` 返回 JSON 值即自动满足。

## 权威文档在哪

- 文档站（公开）：`develop/basic/*`（第一插件、工具、配置、打包安装）、`develop/framework/*`、`develop/cordis-tutorial/*`（7 章手把手）、`reference/*`（primer、subsystems、cookbook）。
- dsh 源码 checkout：`docs/` 与网站同源；`apps/cli/reference/README.md` 拥有 CLI/profile 机制。
