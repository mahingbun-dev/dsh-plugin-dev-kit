# 服务提供者与能力接缝

> [seam-provider.md](../references/seam-provider.md) 的中文镜像。当用户要实现/替换**平台能力**（文件系统、shell、沙箱、模型适配器、会话存储……）而非加模型工具时读这篇。

## 何时新建接缝 vs 复用

- 复用：该能力已有接缝（`docs/capability-seams.md` 列了 30+）就为它写 **Provider**——几乎总是正确答案。
- 新建：只为真正新的可替换能力建接缝；三角色缺一不成缝。若"能力"只有一个实现和一个消费者，传普通函数/闭包即可，别建服务（反向气味，见 `packages/AGENTS.md`）。

## 三角色实例（shell 接缝）

**Definition**（`packages/shell/shell/src/index.ts`）：

```ts
declare module '@deepseek-ai/cordis' {
  interface Context { shell: ShellExecutor }
}
export abstract class ShellExecutor extends Service {
  constructor(ctx: Context) { super(ctx, 'shell') }   // 注册 ctx.shell
  abstract resolve(request: ShellExecRequest): ShellExecSpec
  abstract execute(spec: ShellExecSpec): Promise<ShellExecution>
  // 词汇类型也在这里：ShellExecRequest、ShellRunResult……
}
```

**Provider**（`packages/shell/bash-local/src/index.ts`）：

```ts
export class LocalBashExecutor extends ShellExecutor {
  static inject = ['subprocess']            // 消费另一条接缝
  static Config = z.object({ ... })
  constructor(ctx: Context, readonly config: Config) { super(ctx) }
}
```

**Consumer**（`packages/shell/tool-bash/src/index.ts`）：

```ts
export const inject = ['tools', 'shell', 'systemPrompt']
export function apply(ctx, config) {
  // ctx.shell.* —— 经 declaration merging 获得类型；对挂的是哪个 Provider 零感知
}
```

## API 机制（`vendor/cordis/src/{service,reflect,registry,fiber}.ts`）

- `Service` 子类里 `super(ctx, '<key>')` 立刻调 `ctx.provide('<key>', this)`——实例即 `ctx.<key>`；同名重复注册抛错。
- 消费三种写法：`export const inject = ['key']`（必需，缺则挂起）、`ctx.get('key')`（可选）、`ctx.inject(['key'], cb)`（随来随走，服务出现/消失时 cb 重跑且效应回滚）。
- 未 inject 就读 `ctx.<key>` 运行时直接抛错——代理强制显式依赖。
- Registry（`ctx.tools`、`ctx.llm`）是带 `registerXxx()` 的具体 Service，返回 disposer；Provider 在 `ctx.effect` 里调用它们。

## 包依赖纪律（最容易错的部分）

| 依赖 | 写在哪 |
| --- | --- |
| 需与宿主共享实例的有状态 dsh 包（`dsh-shell`、`dsh-tools`、`dsh-subprocess`、`dsh-llm`……） | `peerDependencies` **且** `devDependencies`（同 range） |
| 无状态 dsh 工具（`dsh-brand`、`dsh-util-values`、`dsh-timeout`） | `dependencies` |
| 独立版本演进的三方包 | `dependencies` |
| `@deepseek-ai/cordis` | 恒为 peer + dev（同 range） |

有状态 dsh 包写进 `dependencies` = **第二个实例**——典型 bug：插件改的状态别人看不见。peer 占位触发 dsh 运行时解析替换为运行中安装的副本；dev 副本只服务类型检查与独立测试。Consumer 只 import Definition 包（类型/词汇/纯函数）；Provider 包只出现在测试与组合文件里。

## in-repo 包（给 dsh monorepo 贡献）

遵循 `docs/cookbook/adding-a-package.md`，骨架：

1. `packages/<组>/<包>/`：`package.json`（拷 `packages/core/tools` 改：`private: true`、版本随根、`type: module`、`main: lib/index.js`、`exports["."]`→lib、cordis 进 peer+dev、`files` 白名单）+ `tsconfig.json`（extends `tsconfig.base.json`）。
2. 把包登记进 `tsconfig.host.json` **或** `tsconfig.client.json` 的 references；根 workspaces/glob 自动覆盖其余。
3. `src/index.ts`：服务包默认导出服务类；函数插件用命名导出（`name`/`inject`/`apply`/`Config`）。绝不混用。
4. 显示元数据：`locale/en.json` + `locale/zh.json`（`meta.title`/`meta.description`）、可选顶层 `icon`（SVG/PNG/JPEG/WebP ≤ 256 KiB）、`exports["./package.json"]` + `exports["./locale/*.json"]`。
5. 测试：包单测 `tests/*.spec.ts` + REAL-composition 测试（见 [testing.zh.md](testing.zh.md)）；产品可见插件必须有后者。
6. 验证：`pnpm install && pnpm run doc-sync && constraints && typecheck && lint && build && hygiene`。

角色命名（cookbook）：Controller（路由调用）、Store（状态）、Registry（多 provider 接缝）、Runtime（生命周期）等——先读 cookbook 表再发明后缀。

## LLM 适配器

模型 provider 是特殊的 provider 家族：实现适配器接缝后经 `ctx.llm.registerAdapter([provider], adapter)` 注册到 `ctx.llm`（注册句柄支持原子 `replace`，用于凭据热更）。参考实现 `packages/llm/llm-deepseek`、`packages/llm/llm-pi-ai`；指南 `docs/cookbook/adding-an-llm-adapter.md`。
