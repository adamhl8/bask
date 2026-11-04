import fs from "node:fs/promises"
import path from "node:path"

import { copyFixture, minimalEnv, packPackage } from "@adamhl8/configs/test"
import bun from "bun"
import { attempt, getContext, isErr, messageChain } from "ts-explicit-errors"

import type { runBask } from "#run-bask.ts"

const ROOT = path.resolve(import.meta.dir, "../..")
const RUN_BASK_MODULE = path.resolve(import.meta.dir, "../run-bask.ts")
const FIXTURE = path.resolve(import.meta.dir, "fixtures/project")
const BASK_FILES = path.resolve(import.meta.dir, "fixtures/bask-files")
const FINAL_NEWLINE = /\n$/v

interface ProjectOptions {
  /** A file in `fixtures/bask-files` that replaces the fixture's `bask.ts`, or a folder copied over the fixture. */
  baskFile?: string
}

/** Copies the fixture into a temp dir, installs the packed bask, and returns the dir and a shell bound to it. */
export const createProject = async ({ baskFile }: ProjectOptions = {}) => {
  const tarball = await packPackage(ROOT)
  const { dir, run } = await copyFixture(FIXTURE, { shell: { env: minimalEnv() } })
  if (baskFile !== undefined) {
    const source = path.join(BASK_FILES, baskFile)
    const isFolder = (await fs.stat(source)).isDirectory()
    await fs.cp(source, isFolder ? dir : path.join(dir, "bask.ts"), { recursive: true })
  }

  await run`bun add -d ${tarball}`

  return { dir, run }
}

/** Decodes a chunk and strips its color, because `styleText` adds color when `FORCE_COLOR` is set. */
const toText = (chunk: string | Uint8Array) =>
  bun.stripANSI(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk))

/** Creates a non-terminal stream that passes everything written to it to `write`. */
const createCaptureStream = (write: (text: string) => void): unknown =>
  Object.create(process.stdout, {
    isTTY: { value: false },
    write: {
      value: (chunk: string | Uint8Array) => {
        write(toText(chunk))
        return true
      },
    },
  })

/**
 * Runs `runBask` in its own module graph, and returns what it reported, what it threw, and what it wrote to `console`
 * and `process`. A new graph gives every run its own tasks and loaded bask file, because each only exists once per
 * process. Its own `process` and `console` let these runs happen concurrently. Commands still write to the real stdout,
 * unless they're quiet.
 */
export const runInProcess = async (baskPath: string, ...args: string[]) => {
  let stdout = ""
  let stderr = ""
  // oxlint-disable-next-line typescript/no-unsafe-assignment - `Object.create` returns `any`, and this inherits the rest of `process`
  const graphProcess: NodeJS.Process = Object.create(process, {
    env: { value: minimalEnv(), enumerable: true },
    stdout: {
      value: createCaptureStream((text) => {
        stdout += text
      }),
    },
    stderr: {
      value: createCaptureStream((text) => {
        stderr += text
      }),
    },
  })
  // oxlint-disable-next-line typescript/no-unsafe-assignment - `Object.create` returns `any`, and this inherits the rest of `console`
  const graphConsole: Console = Object.create(console, {
    log: {
      value: (...values: unknown[]) => {
        stdout += `${values.join(" ")}\n`
      },
    },
  })

  const graph = new bun.ModuleGraph({ globals: { process: graphProcess, console: graphConsole } })
  const runBaskModule = await graph.import<{ runBask: typeof runBask }>(RUN_BASK_MODULE)
  // Wrap the returned `Result` so an error `runBask` returned stays separate from one it threw.
  const run = await attempt(async () => {
    const result = await graph.run(async () => runBaskModule.runBask(args, baskPath))
    return { result }
  })
  // Fire the exit listeners because they're on `graphProcess`, which never exits.
  graphProcess.emit("exit", 0)
  graph.dispose()

  const result = isErr(run) ? undefined : run.result
  return {
    stdout: stdout.replace(FINAL_NEWLINE, ""),
    stderr: stderr.replace(FINAL_NEWLINE, ""),
    errorMessage: isErr(result) ? messageChain(result) : undefined,
    exitCode: isErr(result) ? getContext<number>(result, "exitCode") : undefined,
    thrownMessage: isErr(run) ? run.message : undefined,
  }
}
