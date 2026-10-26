import { describe, expect, it, setDefaultTimeout } from "bun:test"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

describe("dependencies", () => {
  it("runs a dependency once when several tasks call it", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stdout } = await run`bask check`

    expect(stdout).toBe("ran setup\nran lint\nran build")
  })

  it("shares one run between tasks that call a dependency at the same time", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stdout } = await run`bask parallel`

    expect(stdout).toBe("ran setup\nran lint\nran build")
  })

  it("fails again without rerunning when a failed task is called again", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stdout, stderr, exitCode } = await run`bask retry`.nothrow()

    expect(exitCode).toBe(8)
    expect(stdout).toBe("ran flaky\ncaught flaky")
    expect(stderr).toBe("exit 8\nerror: task 'flaky' failed with exit code 8")
  })
})

describe("hooks", () => {
  it("runs hooks in the order they were added", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stdout } = await run`bask compile`

    expect(stdout).toBe("ran clean\nran before hook\nran compile\nran after hook")
  })

  it("runs hooks once when another task calls the task", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stdout } = await run`bask release`

    expect(stdout).toBe("ran clean\nran before hook\nran compile\nran after hook\nran release")
  })

  it("names the task when its hook fails", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stdout, stderr, exitCode } = await run`bask deploy`.nothrow()

    expect(exitCode).toBe(6)
    expect(stdout).toBe("ran deploy")
    expect(stderr).toBe("exit 6\nerror: task 'deploy' failed with exit code 6")
  })

  it("names the hook when a hook that's a task fails", async () => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stderr, exitCode } = await run`bask publish`.nothrow()

    expect(exitCode).toBe(7)
    expect(stderr).toBe("exit 7\nerror: task 'verify' failed with exit code 7")
  })

  it.each(["late-before", "late-after"])("throws when a hook is added to a task that has started: %s", async (name) => {
    const { run } = await createProject({ baskFile: "task/tasks.ts" })

    const { stderr, exitCode } = await run`bask ${name}`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toContain("error: Can't add a hook to a task that has already started")
    expect(stderr).not.toContain("ran late hook")
  })

  it("runs hooks on the built-in list task", async () => {
    const { run } = await createProject({ baskFile: "task/list-hooks.ts" })

    const { stdout } = await run`bask -l`

    expect(stdout).toBe("Available tasks:\n    build\n\nRun `bask <task>` to run a task.")
  })
})

describe("task()", () => {
  it("throws without a callback", async () => {
    const { run } = await createProject({ baskFile: "task/missing-callback.ts" })

    const { stderr, exitCode } = await run`bask build`.nothrow()

    expect(exitCode).toBe(1)
    expect(stderr).toContain("error: task() needs a callback")
  })
})
