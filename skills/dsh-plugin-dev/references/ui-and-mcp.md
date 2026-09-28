# UI plugins and MCP bundles

## UI plugins (Harness Web UI)

A UI plugin has two halves in one package: a Host half (an ordinary plugin —
often an empty `apply`) and a **Client module** that the browser loads through
the Client module loader. The manifest wires them together:

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

- `exports["./client"]` and `dsh.client` must be present together or absent
  together (a config gate enforces this in-repo).
- `inject` lists the client packages whose slots/props you need — they become
  `require()`-able inside your client module from the shared platform base
  (React, Cordis, static UI libs) plus what you declare here.

The Client module registers into the browser's Cordis tree through the module
loader (see `templates/ui-plugin/client.js`):

```js
window.__ModuleLoader__.load({
  id: '@local/my-decoration',           // must match the package name
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

Rules that keep UI plugins welcome:

- Query live slots with `cordis_inspect_query` (`Slots.listSubTree`) before
  choosing a slot; use only theme tokens for colors/spacing — no hardcoded
  palette; read correctly in light and dark themes.
- Do not import Harness Client packages beyond the ones declared in
  `dsh.client.inject`.
- The **installed plugin rendered in the connected page** is the first preview.
  Do not build mock HTML shells, preview servers, or screenshot rigs before
  installing; state verification limits explicitly when no browser control is
  available (installation + slot registration observed ≠ pixel-perfect proof).
- Replacing installed client code needs a restart to load a fresh module
  generation; do not infer updated browser code from an unchanged slot id.

## MCP bundles (configuration only, no code)

Two files connect an MCP server; the plugin row configures `dsh-mcp-client`:

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

- `failOnStartupError: true` makes misconfiguration loud at boot (the dsh way);
  set `false` only when the server is optional.
- Transport options depend on your baseline — query the installed
  `dsh-mcp-client` Config schema with `Config.listConfigs` instead of guessing.
- This pattern generalizes: **any shipped-but-disabled plugin can be enabled by
  a two-line bundle** that overrides its row (`disabled: false`) and inserts the
  Host rows it depends on. Shipped rows' ids and reasons live in
  `packages/bundle/*/cordis.patch.yml` of a source checkout.

## Display metadata and icons (all bundle kinds)

Plugin Manager cards and the Settings inventory read:

- `locale/en.json` (+ `locale/zh.json`): `{ "meta": { "title": "...", "description": "..." } }`
- `package.json`: top-level `icon` (relative path; SVG/PNG/JPEG/WebP ≤ 256 KiB;
  no absolute paths/URLs/symlink escapes), plus
  `exports["./package.json"]`, `exports["./locale/*.json"]`,
  `files: ["locale/*.json", "icon.svg"]`.

Missing fields fall back to the package `name`/`description` and default
artwork; malformed metadata yields a diagnostic and keeps valid text.
