# 测试与验证

> [testing.md](../references/testing.md) 的中文镜像。

验证阶梯——逐级爬，不许跳到"应该能行"：

1. **组合**：`dsh --profile <name> --dump-config`（免 key）显示你的行出现在组合树里。这里缺行 = manifest/patch 问题，不是代码问题。
2. **激活**：启动 profile；读安装/启动结果字段（`application`、`warnings`、`restart-required`、`failed`、`overridden`）。`overridden` = 更高层替换了你的行（查层序）；`restart-required` = 尚未生效。
3. **能力**：端到端行使一次工具/部件。
4. **持久证明**：自动化测试（下文）。

## 外部插件（独立运行，无需 monorepo）

用 Node 内置 runner 给纯逻辑做单测——不需要 dsh：

```js
// tests/plugin.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { rollDice } from '../index.js'

test('rollDice returns bounds', () => {
  for (let i = 0; i < 100; i++) {
    const v = rollDice(6)
    assert.ok(v >= 1 && v <= 6)
  }
})
```

```sh
node --test
```

再加 manifest 断言（便宜且出奇有效）：package.json 有 `dsh.bundle.patch`；patch 行 `name` 等于包 `name`；`exports` 引用的每个文件都存在。`examples/dice-tool/tests/` 就是这么做的。CI 里跑 `node --check index.js` 查语法。

## REAL-composition 测试（dsh 的测试契约）

出自 `docs/testing.md`：产品可见插件需要一个用**真实 Loader** 启动测试用 `cordis.yml` 的测试——不要手搓 `ctx.plugin(...)`，那会绕开组合路径里真正的 bug 源（config 校验、inject 门控、patch 方言、模块解析）。只 mock 外部服务与非确定输入。

骨架（改编自 `packages/llm/llm-deepseek/tests/loader-composition.spec.ts`）：

```ts
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-loader'
import { Include } from '@deepseek-ai/cordis-include'

// 构造模块表让 cordis.yml 的 bare 名可解析
// （或把 baseUrl 指向你的包目录），然后：
const ctx = new Context()
await ctx.plugin(Loader)
ctx.loader.builtins.include = Include
ctx.loader.create({ name: 'cordis:include', config: { path: fileURL(new URL('./fixtures/cordis.yml', import.meta.url)) } })
await ctx.loader.await()
// 断言：工具已注册、服务已提供、事件被观察到……
```

`fixtures/cordis.yml` 用与生产相同的行方言（`- insert: [{ id, name, config }]`）。每个场景一个夹具；断言模型可见或用户可见的结果（`ctx.tools.get` 确认工具在册、服务方法返回桩数据）。

## in-repo（monorepo）测试底线

- 包单测：`packages/<组>/<包>/tests/*.spec.ts`（vitest，源平面解析走 tsconfig paths——绝不经构建产物 `lib/`）。
- REAL-composition：包级放包内 `tests/`；profile 级放 `apps/cli/tests/profiles/`（参考 `apps/cli/tests/profiles/headless/tests/` 及共享 `harness.ts`）。
- profile 解析正确性（peer 拦截、共享实例）：声明了 peer 的插件模仿 `apps/cli/tests/profiles/headless/tests/profile-resolution.ts` 的矩阵。
- in-repo 贡献者的推送前门禁：`pnpm run doc-sync`、`constraints`、`typecheck`、`lint`、`build`、`hygiene`；CI 覆盖率门禁是 `test:coverage` 而非 `test`（`packages/*/*/src` 逐文件 100%）。

## 提前设计测试计划

加能力时就规划 单测 + 组合 + 转写/输出 覆盖：能力接缝、生命周期路径、模型/用户所见 各要一个测试。快照夹具缺你的面支持时，在同一变更里补上夹具支持，而不是跳过测试。
