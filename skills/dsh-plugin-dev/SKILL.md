---
name: dsh-plugin-dev
description: >-
  Build, test, install, and debug plugins for DeepSeek Harness (dsh, built on the
  vendored Cordis framework): model-facing tools, web UI plugins, MCP connections,
  service providers for capability seams, or wrapping an existing app/API into dsh.
  Use whenever the user wants to add a tool, capability, widget, or integration to
  dsh / DeepSeek Harness, author a Cordis plugin or bundle, or connect their own
  project or service to a dsh agent — even if they only say "add a tool to my
  agent" while working in a dsh checkout, a profile, or a dsh plugin workspace.
---

# dsh plugin development

Turn a user request into a working, installed, verified dsh plugin. Everything
in DeepSeek Harness is a plugin (the model adapters, the tool registry, the
session log, the agent loop itself), and plugins are composed from YAML patch
layers — so the fastest correct route is: pick the right template, change the
fewest things, install through `dsh plugin`, and verify through the composed
config before celebrating.

Baseline: written against dsh `0.1.7-rc.x`. dsh APIs are pre-stable and evolve;
when anything here disagrees with the runtime, trust `dsh --dump-config`,
`cordis_inspect_query`, and the installed packages' own `.d.ts` files, then fix
this skill's assumption rather than working around the framework.

## Mental model in ten lines

1. A plugin is an ES module exporting `apply(ctx, config)` (plus optional
   `name`, `inject`, `Config`), or a service class as default export. Never mix
   both forms in one module.
2. `ctx` is a service repository: a service claims a stable `ctx.<key>`
   (`ctx.tools`, `ctx.llm`, `ctx.shell`, `ctx.fs`, ...). Plugins find services
   by key via `inject`, never by importing another plugin's implementation.
3. A capability seam has three roles: **Service Definition** (abstract class
   owning `ctx.<key>`), **Service Provider** (implements it), **Consumer**
   (injects the key). Providers are swappable; consumers never change.
4. Every registration (`ctx.provide`, `ctx.on`, `ctx.tools.register`, ...) must
   return or register a disposer via `ctx.effect` — uninstall unrolls them in
   reverse order.
5. Events are the extension points. `emit` observes; **`waterfall` is
   middleware: call `next()` to delegate, return without it to veto**.
6. The session log is the only durable fact source. What the model sees must be
   reconstructable from the log; tools get this for free via `tool/result`.
7. Composition: a **bundle** (npm package declaring `dsh.bundle.patch`)
   contributes a YAML patch layer; a **profile** lists bundles in order; later
   layers override earlier rows **by id, replacing the whole `config`**.
8. A patch row is `{ id, name, config? }`; `name` is the module specifier Node
   resolves. `insert` adds rows; a later row with the same `id` replaces it.
9. `config` is validated by the plugin's `Config` schema (Schemastery) at
   activation; `.volatile()` fields hot-update without remounting.
10. `disabled` (boolean or `!!js` expression) is the only manifest field
    allowed to be an expression; `id`/`name`/`inject`/`config` statics must be
    literal.

## Step 1 — Decide the path

| User wants | Path | Start from |
| --- | --- | --- |
| A tool the model can call (`weather`, `query_db`, ...) | **Tool plugin** | `templates/tool-plugin/` + [references/tool-plugin.md](references/tool-plugin.md) |
| A widget/card/page in the Harness Web UI | **UI plugin** | `templates/ui-plugin/` + [references/ui-and-mcp.md](references/ui-and-mcp.md) |
| Connect an existing MCP server | **Config-only MCP bundle** (no code) | `templates/mcp-config-only/` + [references/ui-and-mcp.md](references/ui-and-mcp.md) |
| Make their existing app/API callable by the agent | **Wrap existing project** | `templates/wrap-existing/` + [references/wrap-existing-project.md](references/wrap-existing-project.md) |
| Implement or swap a platform capability (shell, fs, llm adapter, sandbox...) | **Seam provider / in-repo package** | [references/seam-provider.md](references/seam-provider.md) |

In-repo packages (inside the dsh monorepo, `@deepseek-ai/dsh-*`) follow the
maintainer cookbook instead of the bundle flow — see
[references/seam-provider.md](references/seam-provider.md) § "In-repo packages".

## Step 2 — Discover before you write

- `dsh --profile "$DSH_PROFILE" --dump-config` prints the composed plugin tree;
  every row it prints can be overridden by a patch. Keyless, fast, always do
  this first when a dsh shell is available.
- Inside a running Harness **agent session**, `cordis_inspect_list` /
  `cordis_inspect_query` are agent tools (not shell commands): they answer
  exact Service methods, Event modes, installed Config schemas
  (`Config.listConfigs`), available Tools, and live Client Slots. Query the two
  or three APIs you will actually touch; do not enumerate. In a CLI-only
  environment without them, `--dump-config` plus the installed packages' `.d.ts`
  files are the fallback.
- Installed packages ship `lib/index.js` + `lib/types/**/*.d.ts` with JSDoc
  under their resolved `packageDir` — read the `.d.ts` of any service you
  inject.

## Step 3 — Write from the template

Copy the chosen template's files into ONE workspace directory (never install or
edit in place), then:

1. Rename — and know the three different names:
   | Name | Must be | Used by |
   | --- | --- | --- |
   | package `name` | your choice (e.g. `dsh-my-tool` or `@local/my-tool`) | install + Node resolution |
   | patch row `name` | **exactly** the package `name` | Node resolves the installed code |
   | patch row `id` | unique across the profile | layer overrides match on it |
   | `export const name` | plugin metadata, free-form | display / diagnostics only |
2. Keep the export form the template uses. A tool plugin is
   `export const inject = ['tools']` + `export function apply(ctx, config)`.
3. Register inside `apply` through the owning registry (`ctx.tools.register`)
   or `ctx.effect`/`ctx.on`, never at module top level.
4. If the plugin needs options, export `Config` (Schemastery `z`) and put
   defaults in the patch row's `config`. Prefer defaults users keep.
5. Check syntax: `node --check index.js` — run it **inside the package
   directory** (the `type: module` in package.json is what makes ESM imports
   parse) and JSON/YAML-parse the manifest.

## Step 4 — Install and verify

```sh
dsh plugin --profile demo add ./your-plugin        # local checkout
dsh plugin --profile demo add github:you/your-plugin  # git (see pitfall P3)
dsh plugin --profile demo add ./your-plugin-0.1.0.tgz # tarball / npm: no build step
dsh --profile demo --dump-config                   # your layer must appear
```

`dsh plugin add` is the only supported installer: it runs pnpm in the profile
and appends the bundle to `dsh.profile.bundles`. Never hand-edit the profile's
`package.json` / `cordis.patch.yml`, never create packages under `$DSH_HOME`,
never run pnpm in the profile directory.

Verification ladder, in order — do not skip to "it should work":

1. `--dump-config` shows your rows (composition correct).
2. Boot and exercise the capability; for UI plugins the installed plugin in the
   connected page is the first preview (no mock shells before this).
3. Durable proof: a REAL-composition test (real Loader + `cordis.yml` fixture)
   — see [references/testing.md](references/testing.md).

Read the installer result: `warnings` and failure fields decide the next step,
not terminal vibes. `restart-required` means the change is not live yet.

## Red lines (each has bitten someone)

| # | Rule | Why |
| --- | --- | --- |
| P1 | Package must declare `dsh.bundle.patch` | Without it the package installs as a plain dependency and **activates no layer** — plugin looks installed but never loads |
| P2 | Stateful dsh packages go under `peerDependencies` **and** `devDependencies` (same range); stateless utils and third-party deps under `dependencies` | A `dependencies` copy of a stateful dsh package creates a **second instance**; peers resolve to the running installation's copy |
| P3 | Git installs need a self-contained `prepare` build script **and** user `allowBuilds` allowance | Git fetches sources, not built artifacts; pnpm ≥10 blocks `prepare` until allowlisted — treat the allowance as executing the author's code |
| P4 | Patch rows replace the whole `config`; overriding a row restates every key | Patches do not deep-merge; dropping keys silently changes behavior |
| P5 | Never hand-edit profile manifests; never `$DSH_HOME` packages; never pnpm in profile | `dsh plugin` owns those files with locking and reconciliation |
| P6 | One export form per module (function plugin or default-export service class) | Mixing makes the Loader drop the function-plugin namespace |
| P7 | Every registration returns a disposer | Without it HMR/uninstall leaks listeners and tools |
| P8 | `@deepseek-ai/cordis` in both peer + dev with the same range | Required by package hygiene; peer placeholder triggers runtime resolution |

Full list with fixes: [references/pitfalls.md](references/pitfalls.md).

## Read next

| Task | File |
| --- | --- |
| Framework mental model, dispatch modes, layer order, session log | [references/architecture-map.md](references/architecture-map.md) |
| Tool plugin contract (`defineTool`, output schema, guards, events) | [references/tool-plugin.md](references/tool-plugin.md) |
| Implementing/swapping a capability seam; in-repo packages | [references/seam-provider.md](references/seam-provider.md) |
| Wrapping an existing app/API/CLI into dsh | [references/wrap-existing-project.md](references/wrap-existing-project.md) |
| UI plugins (Client module loader, slots) and MCP bundles | [references/ui-and-mcp.md](references/ui-and-mcp.md) |
| Testing: unit, REAL-composition, profile harness, verification limits | [references/testing.md](references/testing.md) |
| All pitfalls with concrete fixes | [references/pitfalls.md](references/pitfalls.md) |
| **Installed but not working? Symptom-organized diagnosis trees** | [references/troubleshooting.md](references/troubleshooting.md) |
| Starting points (inside this skill directory) | `templates/{tool-plugin,ui-plugin,mcp-config-only,wrap-existing}/` |
| Complete worked example (in the kit repo checkout) | `examples/dice-tool/` |

Chinese mirrors of every reference live under [zh/](zh/SKILL.zh.md); prefer
them when the user converses in Chinese.

## Environment facts

- `DSH_PROFILE` (profile name) and `DSH_PROFILE_DIR` (its directory) are set in
  every shell of a profile-launched Harness; absent without a profile. Bash
  reads `$DSH_PROFILE`; PowerShell reads `$env:DSH_PROFILE`.
- Profiles live under `$DSH_HOME/profiles/<name>`; profile `node_modules`
  holds only out-of-tree installed bundles. In-box `@deepseek-ai/dsh-*` packages
  resolve from the dsh installation itself — your bundle can rely on
  `@deepseek-ai/dsh-base` being present and current.
- Loader patch dialect reference: patch is a YAML array; rows support `id`,
  `name`, `inject`, `config`, `disabled` (expression allowed), `insert` blocks.
