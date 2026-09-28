# dsh 插件开发（SKILL 中文镜像）

> 这是 [SKILL.md](../SKILL.md) 的中文对照版，供中文使用者阅读。Agent 执行时以英文原版为准；本目录同时提供全部 references 的中文镜像。基线：dsh `0.1.7-rc.x`，API 预稳定——与运行时冲突时，以 `dsh --dump-config`、`cordis_inspect_query` 和已安装包的 `.d.ts` 为准。

## 十行心智模型

1. 插件是导出 `apply(ctx, config)` 的 ES 模块（可选 `name`、`inject`、`Config`），或默认导出的 Service 类；同一模块不要混用两种形态。
2. `ctx` 是服务仓库：服务占据稳定的 `ctx.<key>`（`ctx.tools`、`ctx.llm`、`ctx.shell`、`ctx.fs`……）。插件通过 `inject` 按键查找服务，绝不 import 别的插件的实现。
3. 能力接缝有三角色：Service Definition（拥有 `ctx.<key>` 的抽象类）、Service Provider（实现者）、Consumer（注入按键的使用者）。Provider 可换，Consumer 不变。
4. 每个注册（`ctx.provide`、`ctx.on`、`ctx.tools.register`……）都要有 disposer——卸载时逆序回滚。
5. 事件是扩展点。`emit` 观察；**`waterfall` 是中间件：调 `next()` 委托，不调即否决**。
6. session 日志是唯一持久事实源；模型可见 ⟺ 可从日志重建（工具的返回值自动满足）。
7. 组合：bundle（声明 `dsh.bundle.patch` 的 npm 包）贡献一层 YAML patch；profile 按序列出 bundle；后层按 `id` 覆盖前层，**整体替换 `config`**。
8. patch 行是 `{ id, name, config? }`；`name` 是 Node 可解析的模块说明符。`insert` 插行；同 `id` 后行替换前行。
9. `config` 在激活时由插件的 `Config` schema（Schemastery）校验；`.volatile()` 字段热更新不重挂。
10. `disabled`（布尔或 `!!js` 表达式）是唯一允许表达式的 manifest 字段。

## 第 1 步 · 选路径

| 用户想要 | 路径 | 起点 |
| --- | --- | --- |
| 模型可调用的工具 | 工具插件 | `templates/tool-plugin/` + [tool-plugin.zh.md](tool-plugin.zh.md) |
| Web UI 里的卡片/部件/页面 | UI 插件 | `templates/ui-plugin/` + [ui-and-mcp.zh.md](ui-and-mcp.zh.md) |
| 接入现成 MCP 服务器 | 纯配置 MCP bundle（零代码） | `templates/mcp-config-only/` |
| 让 agent 能调用已有应用/API | 套壳接入 | `templates/wrap-existing/` + [wrap-existing-project.zh.md](wrap-existing-project.zh.md) |
| 实现/替换平台能力（shell、fs、llm 适配器……） | 接缝 Provider / in-repo 包 | [seam-provider.zh.md](seam-provider.zh.md) |

## 第 2 步 · 先探查再动手

- `dsh --profile "$DSH_PROFILE" --dump-config`（免 key）打印组合后的插件树；先跑它。
- 运行中的 Harness 里用 `cordis_inspect_list` / `cordis_inspect_query` 查 Service 方法、Event 模式、已装 Config schema、可用工具、Client Slots——只查要用的两三个 API。
- 已安装的包自带 `lib/index.js` + `lib/types/**/*.d.ts`（含 JSDoc），注入前读一眼类型。

## 第 3 步 · 从模板写起

把模板文件复制到同一个工作区目录（不要原地安装/编辑），然后：

1. 改名：包 `name`、每条 patch 行的 `name`（必须等于包名）与 `id`（profile 内唯一）。
2. 保持模板的导出形态；工具插件是 `export const inject = ['tools']` + `apply(ctx, config)`。
3. 全部注册写在 `apply` 里（经 `ctx.tools.register` / `ctx.effect` / `ctx.on`），不要写在模块顶层。
4. 需要选项就导出 `Config`（Schemastery `z`），默认值放在 patch 行 `config` 里。
5. 语法自查：`node --check index.js`；JSON/YAML 解析 manifest。

## 第 4 步 · 安装与验证

```sh
dsh plugin --profile demo add ./your-plugin            # 本地目录
dsh plugin --profile demo add github:you/your-plugin   # git（见红线 P3）
dsh plugin --profile demo add ./pkg-0.1.0.tgz          # tarball / npm：无需构建许可
dsh --profile demo --dump-config                       # 必须看到你的层
```

`dsh plugin add` 是唯一安装入口（自动维护 profile 的 `dsh.profile.bundles`）。绝不手改 profile 的 `package.json` / `cordis.patch.yml`，绝不在 `$DSH_HOME` 下建包，绝不在 profile 目录跑 pnpm。

验证阶梯（逐级爬，不许跳级）：① dump-config 出现行 → ② 启动并行使能力（UI 插件以已安装插件在页面里的渲染为首个预览，不做 mock 壳）→ ③ REAL-composition 测试（真实 Loader + cordis.yml 夹具，见 [testing.zh.md](testing.zh.md)）。以安装结果的 `application` / `warnings` / `restart-required` 字段为准。

## 红线速查

| # | 规则 | 原因 |
| --- | --- | --- |
| P1 | 包必须声明 `dsh.bundle.patch` | 否则只装不激活——看起来装好了，实际永不加载 |
| P2 | 有状态 dsh 包写 `peerDependencies` + `devDependencies`（同 range）；无状态工具与第三方依赖写 `dependencies` | 有状态包进 `dependencies` 会产生第二个实例 |
| P3 | git 安装需要自带 `prepare` 构建脚本 + 用户 `allowBuilds` 白名单 | git 拉的是源码；pnpm ≥10 默认拒绝跑构建脚本 |
| P4 | patch 覆盖 = 整行 `config` 替换，重写所有键 | 不做深合并，丢键即行为改变 |
| P5 | 不手改 profile 清单、不在 `$DSH_HOME` 建包、不在 profile 跑 pnpm | `dsh plugin` 带锁独占管理 |
| P6 | 一个模块一种导出形态 | 混用使 Loader 丢弃函数插件命名空间 |
| P7 | 每个注册都有 disposer | 否则 HMR/卸载泄漏监听与工具 |
| P8 | `@deepseek-ai/cordis` 同时进 peer + dev（同 range） | 包卫生强制要求 |

完整清单见 [pitfalls.zh.md](pitfalls.zh.md)。

## 环境事实

- profile 启动的 Harness 每个 shell 都有 `DSH_PROFILE`（profile 名）与 `DSH_PROFILE_DIR`（目录）；无 profile 启动时没有。Bash 读 `$DSH_PROFILE`；PowerShell 读 `$env:DSH_PROFILE`。
- profile 在 `$DSH_HOME/profiles/<name>`；其 `node_modules` 只装外部 bundle。内置 `@deepseek-ai/dsh-*` 从 dsh 安装本身解析——你的 bundle 可以放心依赖 `@deepseek-ai/dsh-base` 存在且是当前版本。
