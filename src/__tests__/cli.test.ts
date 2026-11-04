import { describe, expect, it, setDefaultTimeout } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

import { makeTempDir, minimalEnv } from "@adamhl8/configs/test"
import bun from "bun"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

const STACK_FRAME = /at .*bask\.ts:\d+:\d+/v

/** Runs bask in `dir` with stdout and stderr on one terminal, and returns everything it wrote there. */
const runInTerminal = async (dir: string, ...args: string[]) => {
  const decoder = new TextDecoder()
  let output = ""
  const closed = Promise.withResolvers<undefined>()
  const subprocess = bun.spawn([path.join(dir, "node_modules/.bin/bask"), ...args], {
    cwd: dir,
    env: minimalEnv(),
    terminal: {
      data: (_terminal, data) => {
        output += decoder.decode(data, { stream: true })
      },
      exit: () => {
        closed.resolve(undefined)
      },
    },
  })
  // Wait for the terminal to close as well, because its last output can arrive after the process exits.
  await Promise.all([subprocess.exited, closed.promise])
  return output
}

const writeBin = async (dir: string, name: string, script: string) => {
  const binPath = path.join(dir, "node_modules/.bin", name)
  await bun.write(binPath, script)
  // Set the mode with `chmod` because `Bun.write` ignores its `mode` option.
  await fs.chmod(binPath, 0o755)
}

const echoScript = (output: string) => `#!/bin/sh\necho ${output}\n`
const runtimeScript = `#!/usr/bin/env node\nconsole.log(process.versions.bun ? "bun" : "node")\n`

describe("the bask command", () => {
  it("should run a task named on the command line", async () => {
    const { run } = await createProject()

    const { stdout, exitCode } = await run`bask bump-deps`

    expect(exitCode).toBe(0)
    expect(stdout).toBe("ran bump-deps")
  })

  it("should print the task list to stdout", async () => {
    const { run } = await createProject()

    const { stdout } = await run`bask -l`

    expect(stdout).toBe(`Available tasks:
    build     # Build the project [default] [alias: b]
    bump-deps # [aliases: up, update-deps]
    lint`)
  })

  it("should export the list task from the package", async () => {
    const { run } = await createProject({ baskFile: "list-hooks.ts" })

    const { stdout } = await run`bask -l`

    expect(stdout).toBe("Available tasks:\n    build\n\nRun `bask <task>` to run a task.")
  })

  it("should exit with the failed command's exit code and report it on stderr", async () => {
    const { run } = await createProject({ baskFile: "failures.ts" })

    const { stderr, exitCode } = await run`bask fail`.nothrow()

    expect(exitCode).toBe(3)
    expect(stderr).toBe("exit 3\nerror: task 'fail' failed with exit code 3")
  })

  it("should exit with 2 on an unknown flag", async () => {
    const { run } = await createProject()

    const { stderr, exitCode } = await run`bask --nope`.nothrow()

    expect(exitCode).toBe(2)
    expect(stderr).toStartWith("error: Unknown option '--nope'")
  })

  it("should print a stack trace when a task throws", async () => {
    const { run } = await createProject({ baskFile: "failures.ts" })

    const { stderr, exitCode } = await run`bask crash`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toContain("error: task bug")
    expect(stderr).toMatch(STACK_FRAME)
  })

  it("should refuse to run when bask.ts is run directly", async () => {
    const { run } = await createProject({ baskFile: "logs-on-load.ts" })

    const { stderr, exitCode } = await run`bun bask build`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toBe(
      "error: bask.ts can't be run directly. Use `bunx` instead of `bun`.\nEither run `bunx bask build` or run `bask build` directly (if installed globally).",
    )
  })
})

describe("the project's own install", () => {
  it("should run the project's own bask when started from another install", async () => {
    const { dir } = await createProject()
    const { dir: otherDir, run } = await createProject()

    // Tasks only pass `isTask` in the copy of bask that made them, so this fails unless bask hands off.
    const { stdout } = await run`${path.join(otherDir, "node_modules/.bin/bask")} build`.cwd(dir)

    expect(stdout).toBe("ran build")
  })

  it("should keep the project's bask's exit code when started from another install", async () => {
    const { dir } = await createProject({ baskFile: "failures.ts" })
    const { dir: otherDir, run } = await createProject()

    const { stderr, exitCode } = await run`${path.join(otherDir, "node_modules/.bin/bask")} fail`.cwd(dir).nothrow()

    expect(exitCode).toBe(3)
    expect(stderr).toBe("exit 3\nerror: task 'fail' failed with exit code 3")
  })

  it("should run itself when the project doesn't install bask", async () => {
    const { dir, run } = await createProject()
    const emptyDir = await makeTempDir()
    // Add `node_modules` because Bun auto-installs packages for a folder without one, which would resolve a bask.
    await fs.mkdir(path.join(emptyDir, "node_modules"))

    const { stderr, exitCode } = await run`${path.join(dir, "node_modules/.bin/bask")}`.cwd(emptyDir).nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toBe(`error: no bask.ts in ${await fs.realpath(emptyDir)}`)
  })
})

describe("command output", () => {
  it("should print each command before its output", async () => {
    const { run } = await createProject({ baskFile: "shell.ts" })

    // Redirect stderr into stdout so both share one pipe and keep the order they were written in.
    const { stdout } = await run`bask echo 2>&1`

    expect(stdout).toBe("echo one\none\ntwo\nthree\necho four\nfour")
  })

  it("should hide output with quiet() at every level", async () => {
    const { run } = await createProject({ baskFile: "quiet.ts" })

    const { stdout } = await run`bask levels`

    expect(stdout).toBe("shown by sh")
  })

  it("should not print a failed command's output again when it was already shown", async () => {
    const { run } = await createProject({ baskFile: "quiet.ts" })

    const { stdout, stderr } = await run`bask shown-failure`.nothrow()

    expect(stdout).toBe("out")
    expect(stderr).toBe("err\nerror: task 'shown-failure' failed with exit code 3")
  })

  it("should force color for a command that writes to the terminal, unless it's quiet or the env sets color", async () => {
    const { dir } = await createProject({ baskFile: "shell.ts" })

    const output = await runInTerminal(dir, "color")

    expect(output).toBe("color=1\r\nquiet=\r\nno-color=\r\nforced=0\r\n")
  })
})

describe("the command environment", () => {
  it("should resolve a relative cwd from where bask runs", async () => {
    const { dir, run } = await createProject({ baskFile: "shell.ts" })
    // Compare against the real path because macOS reports the temp dir under /private.
    const realDir = await fs.realpath(dir)

    const { stdout } = await run`bask cwd`

    expect(stdout).toBe(`${realDir}/sub\n${realDir}/sub/inner\n${realDir}`)
  })

  it("should find commands in node_modules/.bin of the current folder and its parents, nearest first", async () => {
    const { dir, run } = await createProject({ baskFile: "bin-path" })
    const nested = path.join(dir, "nested")
    await writeBin(dir, "outer", echoScript("outer"))
    await writeBin(dir, "both", echoScript("outer both"))
    await writeBin(nested, "inner", echoScript("inner"))
    await writeBin(nested, "both", echoScript("inner both"))

    // Start bask through its `.bin` link because `localBins` and package managers put `.bin` on `PATH` themselves.
    const { stdout } = await run`${path.join(dir, "node_modules/.bin/bask")} bins`.cwd(nested).localBins(false)

    expect(stdout).toBe("inner\nouter\ninner both")
  })

  it("should run the real node with bun(false) when bask starts under Bun's own node shim", async () => {
    const { dir, run } = await createProject({ baskFile: "shell.ts" })
    await writeBin(dir, "runtime", runtimeScript)

    const { stdout } = await run`bunx --bun bask bun-off`

    expect(stdout).toBe("node")
  })

  it("should remove its node shim folder when it exits", async () => {
    const { run } = await createProject({ baskFile: "shell.ts" })

    const { stdout: nodePath } = await run`bask node-path`
    const shimDir = path.dirname(nodePath)

    expect(path.basename(shimDir)).toStartWith("bask-node-")
    expect(await fs.exists(shimDir)).toBe(false)
  })
})
