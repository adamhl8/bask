import fs from "node:fs/promises"
import path from "node:path"

import { copyFixture, minimalEnv, packPackage, subprocessCoverageEnv } from "@adamhl8/configs/test"

const ROOT = path.resolve(import.meta.dir, "../..")
const FIXTURE = path.resolve(import.meta.dir, "fixtures/project")
const BASK_FILES = path.resolve(import.meta.dir, "fixtures/bask-files")

let tarball = ""
/** Builds and packs bask into the tarball that `createProject` installs. */
export const packBask = async () => {
  tarball = await packPackage(ROOT)
}

interface ProjectOptions {
  /** A file in `fixtures/bask-files` that replaces the fixture's `bask.ts`, or a folder copied over the fixture. */
  baskFile?: string
}

/** Copies the fixture into a temp dir, installs the packed bask, and returns the dir and a shell bound to it. */
export const createProject = async ({ baskFile }: ProjectOptions = {}) => {
  const { dir, run } = await copyFixture(FIXTURE, { shell: { env: minimalEnv(subprocessCoverageEnv()) } })
  if (baskFile !== undefined) {
    const source = path.join(BASK_FILES, baskFile)
    const isFolder = (await fs.stat(source)).isDirectory()
    await fs.cp(source, isFolder ? dir : path.join(dir, "bask.ts"), { recursive: true })
  }

  await run`bun add -d ${tarball}`

  return { dir, run }
}
