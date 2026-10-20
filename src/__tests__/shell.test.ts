import { describe, expect, it, setDefaultTimeout } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

const writeBin = async (dir: string, name: string, output: string) => {
  const binDir = path.join(dir, "node_modules/.bin")
  await fs.mkdir(binDir, { recursive: true })
  await fs.writeFile(path.join(binDir, name), `#!/bin/sh\necho ${output}\n`, { mode: 0o755 })
}

describe("exit codes", () => {
  it("keeps going after a failed command with nothrow", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run({ reject: false })`bask tolerant`

    expect(exitCode).toBe(0)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3")
  })

  it("keeps going after every failed command with sh.nothrow()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run({ reject: false })`bask shell-nothrow`

    expect(exitCode).toBe(0)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3\nexit 4")
  })

  it("lets a command's throws() override the shell's", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run({ reject: false })`bask throws-toggle`

    expect(exitCode).toBe(5)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3\nexit 5\nerror: task 'throws-toggle' failed with exit code 5")
  })

  it("handles a failed command with catch() and runs finally()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run({ reject: false })`bask catch-finally`

    expect(exitCode).toBe(0)
    expect(stdout).toBe("caught\ndone\nfinally")
    expect(stderr).toBe("exit 3\necho done")
  })
})

describe("printing commands", () => {
  it("prints each command unless echo is off for it or the shell", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask echo`

    expect(stdout).toBe("one\ntwo\nthree\nfour")
    expect(stderr).toBe("echo one\necho four")
  })

  it("prints each command before its output", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    // Run through `sh` so stdout and stderr share one pipe and keep the order they were written in.
    const { stdout } = await run`sh -c ${"bask echo 2>&1"}`

    expect(stdout).toBe("echo one\none\ntwo\nthree\necho four\nfour")
  })

  it("prints the command but not its output with text()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask text`

    expect(stdout).toBe("got hidden")
    expect(stderr).toBe("echo hidden")
  })

  it("prints the command but not its output with json()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask json`

    expect(stdout).toBe('{"name":"bask"}')
    expect(stderr).toBe(String.raw`echo "{\"name\":\"bask\"}"`)
  })

  it("prints the command but not its output with lines()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask lines`

    expect(stdout).toBe("line=a\nline=b")
    expect(stderr).toBe(String.raw`printf '%s\n%s' a b`)
  })

  it("prints the command but not its output with quiet()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask quiet`

    expect(stdout).toBe("done")
    expect(stderr).toBe("echo hidden")
  })

  it("prints interpolated values the way the shell escapes them", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask escaping`

    expect(stdout).toBe("a b.txt c.txt\nit's here\none two")
    expect(stderr).toBe(`echo "a b.txt" c.txt\necho "it's here"\necho one   two`)
  })
})

describe("settings", () => {
  it("resolves a relative cwd from where bask runs", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })
    // Compare against the real path because macOS reports the temp dir under /private.
    const realDir = await fs.realpath(dir)

    const { all } = await run`bask cwd`

    expect(all).toBe(`${realDir}/sub\n${realDir}/sub/inner\n${realDir}`)
  })

  it("replaces the whole environment with env()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { all } = await run`bask env`

    expect(all).toBe("greeting=hi home=\ngreeting=hello")
  })

  it("resets cwd and env when they're called with no argument", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })

    const { all } = await run`bask reset`

    expect(all).toBe(`greeting=\n${await fs.realpath(dir)}`)
  })

  it("reads process.env when a command runs, not when it's created", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { all } = await run`bask process-env`

    expect(all).toBe("greeting=set later")
  })

  it("keeps settings from other tasks and hooks out of a task's shell", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask isolated`

    expect(stdout).toBe(`greeting=\n${await fs.realpath(dir)}`)
    expect(stderr).toBe("echo greeting=$GREETING\npwd")
  })
})

describe("PATH", () => {
  it("finds commands in node_modules/.bin of the current folder and its parents, nearest first", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/bin-path" })
    const nested = path.join(dir, "nested")
    await writeBin(dir, "outer", "outer")
    await writeBin(dir, "both", "outer both")
    await writeBin(nested, "inner", "inner")
    await writeBin(nested, "both", "inner both")

    // Start bask through its `.bin` link because `preferLocal` and package managers put `.bin` on `PATH` themselves.
    const { stdout } = await run({ cwd: nested, preferLocal: false })`${path.join(dir, "node_modules/.bin/bask")} bins`

    expect(stdout).toBe("inner\nouter\ninner both")
  })
})
