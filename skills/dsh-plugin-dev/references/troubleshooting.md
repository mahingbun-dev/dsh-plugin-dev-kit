# Troubleshooting: installed but not working

Diagnose by symptom. The three states that look identical in a UI card are
different things: **installed** (package present in the profile's
`node_modules`), **enabled** (no override row disables it), **active** (its
Fiber reached ACTIVE and contributed). Each tree below tells you which state
actually broke.

## Symptom 1 · No row for my plugin in `--dump-config`

Composition is broken — the plugin never contributed a layer.

1. Does `package.json` declare `"dsh": { "bundle": { "patch": "..." } }` and
   does that file exist? (P1 — without it the package is a plain dependency.)
2. Does the patch contain at least one `- insert:` row?
3. Did the install print a warning about `dsh.bundle`? Re-read the installer
   output before re-running anything.
4. Are you dumping the profile you installed into? `dsh --profile <name>
   --dump-config`; inside a Harness shell, `$DSH_PROFILE` names it.

## Symptom 2 · Row exists, plugin never activates (no visible error)

1. **Disabled by an override row**: toggling in the Plugins page writes a
   `disabled` row into the profile's `cordis.patch.yml`. Re-enable via the
   plugin manager, not by hand (P5).
2. **Silently PENDING** (P13): an `inject` key no running service provides.
   Check with the inspect tools inside a running Harness session
   (`cordis_inspect_list`, then `cordis_inspect_query` on your entry id), or
   compare your `inject` list with the `ctx.` keys `--dump-config` prints.
   Typo `['tool']` vs `['tools']` is the classic.
3. **Overridden**: a later layer (profile patch, home patch, `--patch`) has a
   row with the same `id`. Rename your id — profile-unique and namespaced.
4. **`restart-required`**: the installer reported it; the change is not live
   until a restart. Restart before diagnosing further.

## Symptom 3 · Activates, but the tool is missing

1. **Mixed export forms** (P6): a default export plus named exports — the
   Loader drops the function-plugin namespace, `apply` never runs.
2. Registration happens outside `apply` (module top level) or on an agent
   scope instead of global `ctx.tools.register`.
3. Tool `name` collides with an existing tool or the reserved `run_code`.
4. `Config` validation failed — read the boot/install `failed` reason; fix the
   row `config` against the schema (`Config.listConfigs` shows it).

## Symptom 4 · Tool exists, model never calls it

1. Only `name` / `description` / `parameters` reach the model. Is the
   description concrete about when to use it? Are parameters in the shorthand
   DSL (`{ type, required?, description }`; `{}` when none)?
2. Add a prompt section that says when to prefer the tool
   (`ctx.systemPrompt.addSection`, gated on `ctx.tools.get(name, scope)`).
3. Did you verify with a live boot, or only assume? Climb the ladder in
   [testing.md](testing.md) and a REAL-composition test will show the registry
   state directly.

## Symptom 5 · UI plugin installed, page unchanged

1. Composition/activation: run Symptom 1–2 trees first (Client modules mount
   only when their bundle's row is active).
2. Wrong slot name — query live slots with the inspect tools
   (`Slots.listSubTree`), never guess.
3. Imports beyond `dsh.client.inject`, or hardcoded colors breaking the theme —
   see [ui-and-mcp.md](ui-and-mcp.md).
4. Replaced installed client code without a restart — the browser loads a new
   module generation only after restart.

## Where to read the boot result fields

- `dsh plugin add` output / `plugin_manager` tool result: `application`,
  `warnings`, `restart-required`, `failed`, `overridden` — these decide your
  next step, not terminal vibes.
- `--dump-config`: the composed rows (composition truth, keyless).
- Headless boot (`dsh --profile <name>`) prints startup failures, including
  `StartupError` for missing required entries.
