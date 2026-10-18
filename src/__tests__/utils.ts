import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { execa } from "execa"

const ROOT = path.resolve(import.meta.dir, "../..")
const FIXTURE = path.resolve(import.meta.dir, "fixtures/project")
const BASK_FILES = path.resolve(import.meta.dir, "fixtures/bask-files")

const tempDirs: string[] = []
const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bask-"))
  tempDirs.push(dir)
  return dir
}

export const removeTempDirs = async () => {
  await Promise.all(tempDirs.map(async (dir) => fs.rm(dir, { recursive: true, force: true })))
}

let tarball = ""
/** Builds and packs bask into the tarball that `createProject` installs. */
export const packBask = async () => {
  const root = execa({ cwd: ROOT, preferLocal: true })
  await root`bun tsdown`
  // Skip `prepare` because it rebuilds and runs this repo's own bask tasks.
  const { stdout } = await root`bun pm pack --ignore-scripts --quiet --destination ${await makeTempDir()}`
  tarball = stdout
}

// oxlint-disable-next-line node/no-process-env - the CLI subprocesses need the real `PATH` and `HOME`
const { PATH, HOME } = process.env
// Pass `HOME` so bun uses its normal cache.
const env = { PATH, HOME }

interface ProjectOptions {
  /** A file in `fixtures/bask-files` that replaces the fixture's `bask.ts`, or a folder copied over the fixture. */
  baskFile?: string
}

/** Copies the fixture into a temp dir, installs the packed bask, and returns the dir and an execa bound to it. */
export const createProject = async ({ baskFile }: ProjectOptions = {}) => {
  const dir = await makeTempDir()
  await fs.cp(FIXTURE, dir, { recursive: true })
  if (baskFile !== undefined) {
    const source = path.join(BASK_FILES, baskFile)
    const isFolder = (await fs.stat(source)).isDirectory()
    await fs.cp(source, isFolder ? dir : path.join(dir, "bask.ts"), { recursive: true })
  }

  const run = execa({ cwd: dir, all: true, extendEnv: false, env, preferLocal: true })
  await run`bun add -d ${tarball}`

  return { dir, run }
}
