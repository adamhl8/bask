import { describe, expect, it } from "bun:test"
import path from "node:path"

import { runInProcess } from "#__tests__/utils.ts"

const FIXTURES = path.join(import.meta.dir, "fixtures")
const SHELL = path.join(FIXTURES, "shell.ts")
const QUIET = path.join(FIXTURES, "quiet.ts")
const CONFIG = path.join(FIXTURES, "config.ts")
const SUB_DIR = path.join(FIXTURES, "sub")

describe("exit codes", () => {
  it("should keep going after a failed command with nothrow", async () => {
    const { stdout, stderr, errorMessage } = await runInProcess(SHELL, "tolerant")

    expect(errorMessage).toBeUndefined()
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3")
  })

  it("should keep going after every failed command with sh.nothrow()", async () => {
    const { stdout, stderr, errorMessage } = await runInProcess(SHELL, "shell-nothrow")

    expect(errorMessage).toBeUndefined()
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3\nexit 4")
  })

  it("should let a command's throws() override the shell's", async () => {
    const { stdout, stderr, errorMessage, exitCode } = await runInProcess(SHELL, "throws-toggle")

    expect(exitCode).toBe(5)
    expect(stdout).toBe("kept going")
    expect(stderr).toBe("exit 3\nexit 5")
    expect(errorMessage).toBe("task 'throws-toggle' failed with exit code 5")
  })

  it("should handle a failed command with catch() and run finally()", async () => {
    const { stdout, stderr, errorMessage } = await runInProcess(SHELL, "catch-finally")

    expect(errorMessage).toBeUndefined()
    expect(stdout).toBe("caught\nfinally")
    expect(stderr).toBe("exit 3\necho done")
  })
})

describe("printing commands", () => {
  it("should print each command unless echo is off for it or the shell", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "echo")

    expect(stdout).toBe("one\ntwo\nthree\nfour")
    expect(stderr).toBe("echo one\necho four")
  })

  it("should print the command but not its output with text()", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "text")

    expect(stdout).toBe("got hidden")
    expect(stderr).toBe("echo hidden")
  })

  it("should print the command but not its output with json()", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "json")

    expect(stdout).toBe('{"name":"bask"}')
    expect(stderr).toBe(String.raw`echo "{\"name\":\"bask\"}"`)
  })

  it.each([
    ["arrayBuffer()", "array-buffer"],
    ["blob()", "blob"],
  ])("should print the command but not its output with %s", async (_, taskName) => {
    const { stdout, stderr } = await runInProcess(SHELL, taskName)

    expect(stdout).toBe("got hidden")
    expect(stderr).toBe("echo hidden")
  })

  it("should print the command but not its output with lines()", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "lines")

    expect(stdout).toBe("line=a\nline=b")
    expect(stderr).toBe(String.raw`printf '%s\n%s' a b`)
  })

  it("should print the command but not its output with quiet()", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "quiet")

    expect(stdout).toBe("done")
    expect(stderr).toBe("echo hidden")
  })

  it("should print a command once when it's awaited twice", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "await-twice")

    expect(stdout).toBe("once")
    expect(stderr).toBe("echo once")
  })

  it("should print interpolated values the way the shell escapes them", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "escaping")

    expect(stdout).toBe("a b.txt c.txt\nit's here\none two")
    expect(stderr).toBe(`echo "a b.txt" c.txt\necho "it's here"\necho one   two`)
  })
})

describe("settings", () => {
  it("should apply cwd from the shell and the command", async () => {
    const { stdout } = await runInProcess(SHELL, "cwd")

    expect(stdout).toBe(`${SUB_DIR}\n${SUB_DIR}/inner\n${FIXTURES}`)
  })

  it("should add to the environment with env(), and remove a variable set to undefined", async () => {
    const { stdout } = await runInProcess(SHELL, "env")

    expect(stdout).toBe(`greeting=hi home=${process.env["HOME"]}\ngreeting=hello\ngreeting=hi home=`)
  })

  it("should reset cwd and env when they're called with no argument", async () => {
    const { stdout } = await runInProcess(SHELL, "reset")

    expect(stdout).toBe(`greeting=\n${process.cwd()}`)
  })

  it("should start from process.env as it was when bask.ts loaded, and pass later changes with env(process.env)", async () => {
    const { stdout } = await runInProcess(SHELL, "process-env")

    expect(stdout).toBe("greeting= loaded=at load\ngreeting=set later")
  })

  it("should keep settings from other tasks and hooks out of a task's shell", async () => {
    const { stdout, stderr } = await runInProcess(SHELL, "isolated")

    expect(stdout).toBe(`greeting=\n${process.cwd()}`)
    expect(stderr).toBe("echo greeting=$GREETING\npwd")
  })
})

describe("quiet", () => {
  it.each(["failure", "text-failure", "lines-failure", "shell-quiet-failure"])(
    "should print the hidden output of a failed command when its error reaches the CLI: %s",
    async (taskName) => {
      const { stdout, stderr, errorMessage, exitCode } = await runInProcess(QUIET, taskName)

      expect(exitCode).toBe(3)
      expect(stdout).toBe("out")
      expect(stderr).toBe("err")
      expect(errorMessage).toBe(`task '${taskName}' failed with exit code 3`)
    },
  )

  it("should not print the hidden output of a failure that a task catches", async () => {
    const { stdout } = await runInProcess(QUIET, "caught")

    expect(stdout).toBe("caught")
  })

  it("should rethrow an error that isn't a failed command", async () => {
    const { stdout, thrownMessage } = await runInProcess(QUIET, "missing-cwd")

    expect(stdout).toBe("")
    expect(thrownMessage).toContain("No such file or directory")
  })
})

describe("node", () => {
  it("should run node with Bun unless bun is off for the command or the shell", async () => {
    const { stdout } = await runInProcess(SHELL, "bun-toggle")

    expect(stdout).toBe("bun\nnode\nnode\nbun")
  })

  it("should run node with Bun when env() adds variables", async () => {
    const { stdout } = await runInProcess(SHELL, "bun-env")

    expect(stdout).toBe("bun")
  })

  it("should leave PATH unset when env() removes it, with bun on or off", async () => {
    const { stdout } = await runInProcess(SHELL, "no-path")

    expect(stdout).toBe("path=\npath=")
  })
})

describe("baskConfig", () => {
  it("should apply baskConfig to every task and hook shell", async () => {
    const { stdout, stderr, errorMessage } = await runInProcess(CONFIG, "defaults")

    expect(errorMessage).toBeUndefined()
    expect(stdout).toBe(`hook greeting=from config\n${SUB_DIR}\ngreeting=from config\nnode\nkept going`)
    expect(stderr).toBe("")
  })

  it("should let sh and command settings override baskConfig", async () => {
    const { stdout, stderr, errorMessage, exitCode } = await runInProcess(CONFIG, "overrides")

    expect(exitCode).toBe(3)
    expect(stdout).toBe(`greeting=from sh\ngreeting=from command\n${FIXTURES}\nbun`)
    expect(stderr).toBe("echo greeting=$GREETING\npwd\nruntime\nexit 3")
    expect(errorMessage).toBe("task 'overrides' failed with exit code 3")
  })

  it("should add each level's env on top of process.env as it was when bask.ts loaded", async () => {
    const { stdout } = await runInProcess(CONFIG, "layers")

    expect(stdout).toBe("from config sh process command")
  })

  it("should reset cwd and env to baskConfig when they're called with no argument", async () => {
    const { stdout } = await runInProcess(CONFIG, "reset")

    expect(stdout).toBe(`${SUB_DIR}\ngreeting=from config`)
  })
})
