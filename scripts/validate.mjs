/**
 * Validates every template and example in the kit the way dsh would read them:
 * JSON parses, YAML parses, the bundle manifest declares a patch whose rows
 * resolve the package, and every promised file exists. Exit 1 on any failure.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const root = fileURLToPath(new URL('..', import.meta.url))
const failures = []
let checked = 0

function fail(message) {
  failures.push(message)
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.zcode')) continue
    const path = join(dir, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) yield* walk(path)
    else yield path
  }
}

// Every JSON file must parse.
for (const path of walk(root)) {
  if (!path.endsWith('.json') || path.endsWith('package-lock.json')) continue
  checked++
  try {
    JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${relative(root, path)}: invalid JSON — ${error.message}`)
  }
}

// Every YAML file must parse.
for (const path of walk(root)) {
  if (!path.endsWith('.yml') && !path.endsWith('.yaml')) continue
  checked++
  try {
    yaml.load(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${relative(root, path)}: invalid YAML — ${error.message}`)
  }
}

// The skill must keep its required frontmatter.
{
  const skill = readFileSync(join(root, 'skills/dsh-plugin-dev/SKILL.md'), 'utf8')
  checked++
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skill)
  if (!frontmatter || !/^name:\s*dsh-plugin-dev$/m.test(frontmatter[1]) || !/^description:\s*\S/m.test(frontmatter[1])) {
    fail('skills/dsh-plugin-dev/SKILL.md: frontmatter must carry name and description')
  }
}

// Every installable package (template or example) must satisfy the bundle contract.
for (const [dirName, group] of [
  ['templates', join(root, 'skills/dsh-plugin-dev/templates')],
  ['examples', join(root, 'examples')],
]) {
  for (const entry of readdirSync(group)) {
    const dir = join(group, entry)
    if (!statSync(dir).isDirectory()) continue
    const manifestPath = join(dir, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const label = `${dirName}/${entry}`

    checked++
    const patchField = manifest.dsh?.bundle?.patch
    if (!patchField) {
      fail(`${label}: package.json must declare dsh.bundle.patch (P1: installed but inert)`)
      continue
    }
    const patchPath = join(dir, patchField)
    if (!existsSync(patchPath)) {
      fail(`${label}: declared patch file ${patchField} does not exist`)
      continue
    }
    const patch = yaml.load(readFileSync(patchPath, 'utf8'))
    checked++
    const rows = Array.isArray(patch) ? patch.flatMap(layer => layer?.insert ?? []) : []
    if (rows.length === 0) fail(`${label}: patch declares no insert rows`)
    let providesOwnPlugin = false
    for (const row of rows) {
      // A row either mounts this package's own plugin module (name === package
      // name) or configures an in-box shipped package, which always resolves
      // from the dsh installation and needs no dependency declaration.
      if (row?.name === manifest.name) {
        providesOwnPlugin = true
      } else if (!/^@deepseek-ai\/dsh-/.test(String(row?.name))) {
        fail(`${label}: patch row name ${JSON.stringify(row?.name)} must equal the package name ${JSON.stringify(manifest.name)} or an in-box @deepseek-ai/dsh-* package`)
      }
      if (typeof row?.id !== 'string' || row.id.length === 0) {
        fail(`${label}: patch row needs a non-empty id`)
      }
    }
    for (const file of manifest.files ?? []) {
      if (!existsSync(join(dir, file))) fail(`${label}: files entry missing on disk: ${file}`)
    }
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      const target = String(value).replace(/\*\.json$/, 'en.json')
      if (target.includes('*')) continue
      if (!existsSync(join(dir, target))) fail(`${label}: exports["${key}"] target missing: ${value}`)
    }
    if (providesOwnPlugin) {
      for (const file of ['index.js', ...(manifest.exports?.['./client'] ? [manifest.exports['./client']] : [])]) {
        if (!existsSync(join(dir, file))) fail(`${label}: missing expected entry file: ${file}`)
      }
    }
  }
}

console.log(`checked ${checked} artifacts`)
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`)
  for (const message of failures) console.error(` - ${message}`)
  process.exit(1)
}
console.log('all manifest/patch/file checks passed')
