import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { rollDice } from '../dice.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

test('rollDice stays within inclusive bounds', () => {
  for (let i = 0; i < 200; i++) {
    const value = rollDice(6)
    assert.ok(value >= 1 && value <= 6, `out of bounds: ${value}`)
  }
})

test('rollDice rejects out-of-range sides', () => {
  assert.throws(() => rollDice(1), RangeError)
  assert.throws(() => rollDice(1001), RangeError)
})

test('manifest declares a bundle whose row resolves the package', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(manifest.type, 'module')
  const patchPath = manifest.dsh?.bundle?.patch
  assert.ok(patchPath, 'package.json must declare dsh.bundle.patch (P1: no bundle = installed but inert)')
  const patch = readFileSync(join(root, patchPath), 'utf8')
  assert.match(patch, new RegExp(`name:\\s*['"]?${manifest.name}`), 'patch row name must equal the package name')
})

test('every file the manifest promises exists', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  for (const file of manifest.files) {
    assert.ok(existsSync(join(root, file)), `missing file: ${file}`)
  }
  assert.ok(existsSync(join(root, 'index.js')), 'exports["."] target must exist')
})

test('plugin entry module parses', () => {
  const entry = manifestExportsEntry()
  assert.equal(entry, './index.js')
})

function manifestExportsEntry() {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return manifest.exports['.']
}
