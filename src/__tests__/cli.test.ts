import { describe, expect, it, setDefaultTimeout } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

const STACK_FRAME = /at .*bask\.ts:\d+:\d+/v

const TASK_LIST = `Available tasks:
    build     # Build the project [default] [alias: b]
    bump-deps # [aliases: up, update-deps]
    lint`

describe("running tasks", () => {
  it.each(["bump-deps", "bumpDeps"])("runs a task by its name: %s", async (name) => {
    const { run } = await createProject()

    const { stdout } = await run`bask ${name}`

    expect(stdout).toBe("ran bump-deps")
  })

  it.each(["up", "update-deps", "updateDeps"])("runs a task by its alias: %s", async (alias) => {
    const { run } = await createProject()

    const { stdout } = await run`bask ${alias}`

    expect(stdout).toBe("ran bump-deps")
  })

  it("runs a hidden task", async () => {
    const { run } = await createProject()

    const { stdout } = await run`bask release-run`

    expect(stdout).toBe("ran release-run")
  })

  it("runs the default task when no task is named", async () => {
    const { run } = await createProject()

    const { stdout } = await run`bask`

    expect(stdout).toBe("ran build")
  })

  it("lists the tasks when no task is named and there's no default", async () => {
    const { run } = await createProject({ baskFile: "cli/no-default.ts" })

    const { stdout } = await run`bask`

    expect(stdout).toBe("Available tasks:\n    lint")
  })

  it.each(["-l", "--list"])("lists the tasks with %s", async (flag) => {
    const { run } = await createProject()

    const { stdout } = await run`bask ${flag}`

    expect(stdout).toBe(TASK_LIST)
  })

  it("runs the default task by the name 'default'", async () => {
    const { run } = await createProject()

    const { stdout } = await run`bask default`

    expect(stdout).toBe("ran build")
  })

  it("lists and runs a task that's only the default export", async () => {
    const { run } = await createProject({ baskFile: "cli/default-only.ts" })

    const { stdout: list } = await run`bask -l`
    const { stdout: output } = await run`bask`

    expect(list).toBe("Available tasks:\n    default\n    lint")
    expect(output).toBe("ran deploy")
  })

  it.each(["cli/no-tasks.ts", "cli/hidden-only.ts"])(
    "lists no tasks when there are none to show: %s",
    async (baskFile) => {
      const { run } = await createProject({ baskFile })

      const { stdout } = await run`bask`

      expect(stdout).toBe("Available tasks:")
    },
  )
})

describe("failures", () => {
  it("fails on an unknown task", async () => {
    const { run } = await createProject()

    const { stderr, exitCode } = await run`bask nope`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toBe(`error: unknown task 'nope'\n\n${TASK_LIST}`)
  })

  it("fails on 'default' when there's no default task", async () => {
    const { run } = await createProject({ baskFile: "cli/no-default.ts" })

    const { stderr, exitCode } = await run`bask default`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toBe("error: unknown task 'default'\n\nAvailable tasks:\n    lint")
  })

  it("fails on an unknown flag", async () => {
    const { run } = await createProject()

    const { stderr, exitCode } = await run`bask --nope`.nothrow()

    expect(exitCode).toBe(2)
    expect(stderr).toStartWith("error: Unknown option '--nope'")
  })

  it("fails without a bask.ts", async () => {
    const { dir, run } = await createProject()
    await fs.rm(path.join(dir, "bask.ts"))

    const { stderr, exitCode } = await run`bask`.nothrow()

    expect(exitCode).toBe(1)
    // Compare against the real path because macOS reports the temp dir under /private.
    expect(stderr).toBe(`error: no bask.ts in ${await fs.realpath(dir)}`)
  })

  it("refuses to run when bask.ts is run directly", async () => {
    const { run } = await createProject({ baskFile: "cli/logs-on-load.ts" })

    const { stderr, exitCode } = await run`bun bask build`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toBe(
      "error: bask.ts can't be run directly. Use `bunx` instead of `bun`.\nEither run `bunx bask build` or run `bask build` directly (if installed globally).",
    )
  })

  it("exits with the failed command's exit code", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { stderr, exitCode } = await run`bask fail`.nothrow()

    expect(exitCode).toBe(3)
    expect(stderr).toBe("exit 3\nerror: task 'fail' failed with exit code 3")
  })

  it("names the task, not the alias it ran under", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { stderr, exitCode } = await run`bask f`.nothrow()

    expect(exitCode).toBe(3)
    expect(stderr).toBe("exit 3\nerror: task 'fail' failed with exit code 3")
  })

  it("names the dependency that failed", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { stderr, exitCode } = await run`bask build`.nothrow()

    expect(exitCode).toBe(4)
    expect(stderr).toBe("exit 4\nerror: task 'compile' failed with exit code 4")
  })

  it("names the task that was run when the failed task isn't exported", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { stderr, exitCode } = await run`bask deploy`.nothrow()

    expect(exitCode).toBe(5)
    expect(stderr).toBe("exit 5\nerror: task 'deploy' failed with exit code 5")
  })

  it("prints a stack trace when a task throws", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { stderr, exitCode } = await run`bask crash`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toContain("error: task bug")
    expect(stderr).toMatch(STACK_FRAME)
  })

  it.each([
    ["with", "cli/top-level-call.ts"],
    ["without", "cli/top-level-call-unawaited.ts"],
  ])("fails when bask.ts runs a task at its top level %s await", async (_, baskFile) => {
    const { run } = await createProject({ baskFile })

    const { stderr, exitCode } = await run`bask build`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toBe(
      "error: a task ran while bask.ts was loading. Call tasks from inside other tasks, not at the top level.",
    )
  })
})
