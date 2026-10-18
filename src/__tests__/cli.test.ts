import { describe, expect, it, setDefaultTimeout } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

const TASK_LIST = `Available tasks:
    build     # Build the project [default] [alias: b]
    bump-deps # [aliases: up, update-deps]
    lint`

describe("running tasks", () => {
  it.each(["bump-deps", "bumpDeps"])("runs a task by its name: %s", async (name) => {
    const { run } = await createProject()

    const { all } = await run`bask ${name}`

    expect(all).toBe("ran bump-deps")
  })

  it.each(["up", "update-deps", "updateDeps"])("runs a task by its alias: %s", async (alias) => {
    const { run } = await createProject()

    const { all } = await run`bask ${alias}`

    expect(all).toBe("ran bump-deps")
  })

  it("runs a hidden task", async () => {
    const { run } = await createProject()

    const { all } = await run`bask release-run`

    expect(all).toBe("ran release-run")
  })

  it("runs the default task when no task is named", async () => {
    const { run } = await createProject()

    const { all } = await run`bask`

    expect(all).toBe("ran build")
  })

  it("lists the tasks when no task is named and there's no default", async () => {
    const { run } = await createProject({ baskFile: "cli/no-default.ts" })

    const { all } = await run`bask`

    expect(all).toBe("Available tasks:\n    lint")
  })

  it.each(["-l", "--list"])("lists the tasks with %s", async (flag) => {
    const { run } = await createProject()

    const { all } = await run`bask ${flag}`

    expect(all).toBe(TASK_LIST)
  })

  it("runs the default task by the name 'default'", async () => {
    const { run } = await createProject()

    const { all } = await run`bask default`

    expect(all).toBe("ran build")
  })

  it("lists and runs a task that's only the default export", async () => {
    const { run } = await createProject({ baskFile: "cli/default-only.ts" })

    const { all: list } = await run`bask -l`
    const { all: output } = await run`bask`

    expect(list).toBe("Available tasks:\n    default\n    lint")
    expect(output).toBe("ran deploy")
  })

  it.each(["cli/no-tasks.ts", "cli/hidden-only.ts"])(
    "lists no tasks when there are none to show: %s",
    async (baskFile) => {
      const { run } = await createProject({ baskFile })

      const { all } = await run`bask`

      expect(all).toBe("Available tasks:")
    },
  )
})

describe("failures", () => {
  it("fails on an unknown task", async () => {
    const { run } = await createProject()

    const { all, exitCode } = await run({ reject: false })`bask nope`

    expect(exitCode).toBe(1)
    expect(all).toBe(`error: unknown task 'nope'\n\n${TASK_LIST}`)
  })

  it("fails on 'default' when there's no default task", async () => {
    const { run } = await createProject({ baskFile: "cli/no-default.ts" })

    const { all, exitCode } = await run({ reject: false })`bask default`

    expect(exitCode).toBe(1)
    expect(all).toBe("error: unknown task 'default'\n\nAvailable tasks:\n    lint")
  })

  it("fails on an unknown flag", async () => {
    const { run } = await createProject()

    const { all, exitCode } = await run({ reject: false })`bask --nope`

    expect(exitCode).toBe(2)
    expect(all).toStartWith("error: Unknown option '--nope'")
  })

  it("fails without a bask.ts", async () => {
    const { dir, run } = await createProject()
    await fs.rm(path.join(dir, "bask.ts"))

    const { all, exitCode } = await run({ reject: false })`bask`

    expect(exitCode).toBe(1)
    // Compare against the real path because macOS reports the temp dir under /private.
    expect(all).toBe(`error: no bask.ts in ${await fs.realpath(dir)}`)
  })

  it("refuses to run when bask.ts is run directly", async () => {
    const { run } = await createProject({ baskFile: "cli/logs-on-load.ts" })

    const { all, exitCode } = await run({ reject: false })`bun bask build`

    expect(exitCode).toBe(1)
    expect(all).toBe(
      "error: bask.ts can't be run directly. Use `bunx` instead of `bun`.\nEither run `bunx bask build` or run `bask build` directly (if installed globally).",
    )
  })

  it("exits with the failed command's exit code", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { all, exitCode } = await run({ reject: false })`bask fail`

    expect(exitCode).toBe(3)
    expect(all).toBe("exit 3\nerror: task 'fail' failed with exit code 3")
  })

  it("names the task, not the alias it ran under", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { all, exitCode } = await run({ reject: false })`bask f`

    expect(exitCode).toBe(3)
    expect(all).toBe("exit 3\nerror: task 'fail' failed with exit code 3")
  })

  it("names the dependency that failed", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { all, exitCode } = await run({ reject: false })`bask build`

    expect(exitCode).toBe(4)
    expect(all).toBe("exit 4\nerror: task 'compile' failed with exit code 4")
  })

  it("names the task that was run when the failed task isn't exported", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { all, exitCode } = await run({ reject: false })`bask deploy`

    expect(exitCode).toBe(5)
    expect(all).toBe("exit 5\nerror: task 'deploy' failed with exit code 5")
  })

  it("prints a stack trace when a task throws", async () => {
    const { run } = await createProject({ baskFile: "cli/failures.ts" })

    const { all, exitCode } = await run({ reject: false })`bask crash`

    expect(exitCode).toBe(1)
    expect(all).toContain("error: task bug")
    expect(all).toMatch(/at .*bask\.ts:\d+:\d+/v)
  })
})
