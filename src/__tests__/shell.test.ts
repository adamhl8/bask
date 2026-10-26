import { describe, expect, it, setDefaultTimeout } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

import bun from "bun"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

const writeBin = async (dir: string, name: string, script: string) => {
  const binPath = path.join(dir, "node_modules/.bin", name)
  await bun.write(binPath, script)
  // Set the mode with `chmod` because `Bun.write` ignores its `mode` option.
  await fs.chmod(binPath, 0o755)
}

const echoScript = (output: string) => `#!/bin/sh\necho ${output}\n`
const runtimeScript = `#!/usr/bin/env node\nconsole.log(process.versions.bun ? "bun" : "node")\n`

describe("exit codes", () => {
  it("keeps going after a failed command with nothrow", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run`bask tolerant`.nothrow()

    expect(exitCode).toBe(0)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3")
  })

  it("keeps going after every failed command with sh.nothrow()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run`bask shell-nothrow`.nothrow()

    expect(exitCode).toBe(0)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3\nexit 4")
  })

  it("lets a command's throws() override the shell's", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run`bask throws-toggle`.nothrow()

    expect(exitCode).toBe(5)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3\nexit 5\nerror: task 'throws-toggle' failed with exit code 5")
  })

  it("handles a failed command with catch() and runs finally()", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr, exitCode } = await run`bask catch-finally`.nothrow()

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

    // Redirect stderr into stdout so both share one pipe and keep the order they were written in.
    const { stdout } = await run`bask echo 2>&1`

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

    const { stdout } = await run`bask cwd`

    expect(stdout).toBe(`${realDir}/sub\n${realDir}/sub/inner\n${realDir}`)
  })

  it("adds to the environment with env(), and removes a variable set to undefined", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout } = await run`bask env`

    expect(stdout).toBe(`greeting=hi home=${process.env["HOME"]}\ngreeting=hello\ngreeting=hi home=`)
  })

  it("resets cwd and env when they're called with no argument", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout } = await run`bask reset`

    expect(stdout).toBe(`greeting=\n${await fs.realpath(dir)}`)
  })

  it("starts from process.env as it was when bask.ts loaded, and passes later changes with env(process.env)", async () => {
    const { run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout } = await run`bask process-env`

    expect(stdout).toBe("greeting= loaded=at load\ngreeting=set later")
  })

  it("keeps settings from other tasks and hooks out of a task's shell", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })

    const { stdout, stderr } = await run`bask isolated`

    expect(stdout).toBe(`greeting=\n${await fs.realpath(dir)}`)
    expect(stderr).toBe("echo greeting=$GREETING\npwd")
  })
})

describe("quiet", () => {
  it("hides output with quiet() at every level", async () => {
    const { run } = await createProject({ baskFile: "shell/quiet" })

    const { stdout } = await run`bask levels`

    expect(stdout).toBe("shown by sh")
  })

  it.each(["failure", "text-failure"])(
    "prints the hidden output of a failed command when its error reaches the CLI: %s",
    async (taskName) => {
      const { run } = await createProject({ baskFile: "shell/quiet" })

      const { stdout, stderr, exitCode } = await run`bask ${taskName}`.nothrow()

      expect(exitCode).toBe(3)
      expect(stdout).toBe("out")
      expect(stderr).toBe(`err\nerror: task '${taskName}' failed with exit code 3`)
    },
  )

  it("doesn't print a failed command's output again when it was already shown", async () => {
    const { run } = await createProject({ baskFile: "shell/quiet" })

    const { stdout, stderr } = await run`bask shown-failure`.nothrow()

    expect(stdout).toBe("out")
    expect(stderr).toBe("err\nerror: task 'shown-failure' failed with exit code 3")
  })

  it("doesn't print the hidden output of a failure that a task catches", async () => {
    const { run } = await createProject({ baskFile: "shell/quiet" })

    const { stdout } = await run`bask caught`

    expect(stdout).toBe("caught")
  })
})

describe("PATH", () => {
  it("finds commands in node_modules/.bin of the current folder and its parents, nearest first", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/bin-path" })
    const nested = path.join(dir, "nested")
    await writeBin(dir, "outer", echoScript("outer"))
    await writeBin(dir, "both", echoScript("outer both"))
    await writeBin(nested, "inner", echoScript("inner"))
    await writeBin(nested, "both", echoScript("inner both"))

    // Start bask through its `.bin` link because `localBins` and package managers put `.bin` on `PATH` themselves.
    const { stdout } = await run`${path.join(dir, "node_modules/.bin/bask")} bins`.cwd(nested).localBins(false)

    expect(stdout).toBe("inner\nouter\ninner both")
  })
})

describe("node", () => {
  it("runs node with Bun unless bun is off for the command or the shell", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })
    await writeBin(dir, "runtime", runtimeScript)

    const { stdout } = await run`bask bun-toggle`

    expect(stdout).toBe("bun\nnode\nnode\nbun")
  })

  it("runs node with Bun when env() adds variables", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })
    await writeBin(dir, "runtime", runtimeScript)

    const { stdout } = await run`bask bun-env`

    expect(stdout).toBe("bun")
  })

  it("runs the real node with bun(false) when bask starts under Bun's own node shim", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/shell.ts" })
    await writeBin(dir, "runtime", runtimeScript)

    const { stdout } = await run`bunx --bun bask bun-off`

    expect(stdout).toBe("node")
  })
})

describe("baskConfig", () => {
  it("applies baskConfig to every task and hook shell", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/config" })
    await writeBin(dir, "runtime", runtimeScript)
    const realDir = await fs.realpath(dir)

    const { stdout, stderr, exitCode } = await run`bask defaults`

    expect(exitCode).toBe(0)
    expect(stdout).toBe(`hook greeting=from config\n${realDir}/sub\ngreeting=from config\nnode\nkept going`)
    expect(stderr).toBe("")
  })

  it("lets sh and command settings override baskConfig", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/config" })
    await writeBin(dir, "runtime", runtimeScript)
    const realDir = await fs.realpath(dir)

    const { stdout, stderr, exitCode } = await run`bask overrides`.nothrow()

    expect(exitCode).toBe(3)
    expect(stdout).toBe(`greeting=from sh\ngreeting=from command\n${realDir}\nbun`)
    expect(stderr).toBe(
      "echo greeting=$GREETING\npwd\nruntime\nexit 3\nerror: task 'overrides' failed with exit code 3",
    )
  })

  it("adds each level's env on top of process.env as it was when bask.ts loaded", async () => {
    const { run } = await createProject({ baskFile: "shell/config" })

    const { stdout } = await run`bask layers`

    expect(stdout).toBe("from config sh process command")
  })

  it("resets cwd and env to baskConfig when they're called with no argument", async () => {
    const { dir, run } = await createProject({ baskFile: "shell/config" })
    await writeBin(dir, "runtime", runtimeScript)
    const realDir = await fs.realpath(dir)

    const { stdout } = await run`bask reset`

    expect(stdout).toBe(`${realDir}/sub\ngreeting=from config`)
  })
})
