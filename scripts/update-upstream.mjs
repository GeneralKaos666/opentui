#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"

const [tag, commit] = process.argv.slice(2)
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) throw new Error(`Expected stable tag, got ${tag}`)
if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error(`Expected full commit SHA, got ${commit}`)

const path = new URL("../androidtui.json", import.meta.url)
const config = JSON.parse(readFileSync(path, "utf8"))
config.upstream.tag = tag
config.upstream.commit = commit

// Advancing the upstream pin strands a stale releaseVersion on an npm
// version that may already exist — the watcher would build green and then
// die at the publish preflight ("already exists"). Allocate a test slot
// instead: <upstream>-android.N is exactly the new upstream base (verify
// accepts it), publishes under the non-default dist-tag, and leaves the
// stable promotion as an explicit human step once the device smoke test
// passes.
const base = tag.slice(1)
const currentMatchesUpstream =
  config.releaseVersion === base ||
  new RegExp(`^${base.replaceAll(".", "\\.")}-android\\.\\d+$`).test(config.releaseVersion)

function npmVersionExists(version) {
  const result = spawnSync("npm", ["view", `@androidtui/core@${version}`, "version"], {
    encoding: "utf8",
  })
  return result.status === 0
}

if (!currentMatchesUpstream) {
  let n = 1
  while (npmVersionExists(`${base}-android.${n}`)) n += 1
  const previous = config.releaseVersion
  config.releaseVersion = `${base}-android.${n}`
  console.log(
    `Note: staging ${previous} -> ${config.releaseVersion} (test slot behind nothing; promotion to ${base} stays manual).`,
  )
}

writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`)
console.log(`Pinned OpenTUI ${tag} at ${commit}`)
