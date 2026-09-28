# dsh-dice-tool · 完整示例插件

A complete, minimal DeepSeek Harness tool plugin — copy it, install it, and
watch the agent roll dice. 一个完整的最小 dsh 工具插件——复制、安装、看 agent 掷骰子。

## Run the standalone tests · 跑独立测试

```sh
cd examples/dice-tool
node --test
```

No dsh needed — these assert the pure logic AND the manifest contract
(`dsh.bundle.patch` present, patch row name equals package name, files exist).
不需要 dsh——既测纯逻辑，也测 manifest 契约（有 `dsh.bundle.patch`、patch 行名等于包名、文件齐全）。

## Install into a profile · 安装进 profile

```sh
dsh plugin --profile demo add ./examples/dice-tool
dsh --profile demo --dump-config      # a "# == dsh-dice-tool" layer appears
dsh --profile demo                    # boot, then ask: "roll 2d6"
```

## What to notice · 注意这些点

- `package.json` declares `dsh.bundle.patch` — without it the package installs
  but activates nothing (pitfall P1).
  `package.json` 必须声明 `dsh.bundle.patch`——否则只装不激活（红线 P1）。
- dsh packages sit under `peerDependencies` **and** `devDependencies` — the
  profile install needs no registry access; runtime shares the host's copies (P2/P8).
  dsh 包同时在 peer + dev——profile 安装不访问 registry；运行时共享宿主副本（P2/P8）。
- `exports` exposes `./package.json` + `./locale/*.json` and `icon` for the
  Plugin Manager card (display metadata without activating the plugin).
  `exports` 暴露元数据与图标给 Plugin Manager 卡片（不激活也能显示）。
- `index.js` keeps pure logic (`rollDice`) exported so tests run without dsh.
  `index.js` 把纯逻辑（`rollDice`）单独导出，测试无需 dsh。
