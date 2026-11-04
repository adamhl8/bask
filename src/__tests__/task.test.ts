import { describe, expect, it } from "bun:test"
import path from "node:path"

import { runInProcess } from "#__tests__/utils.ts"

const FIXTURES = path.join(import.meta.dir, "fixtures/task")
const TASKS = path.join(FIXTURES, "tasks.ts")

describe("dependencies", () => {
  it("should run a dependency once when several tasks call it", async () => {
    const { stdout } = await runInProcess(TASKS, "check")

    expect(stdout).toBe("ran setup\nran lint\nran build")
  })

  it("should share one run between tasks that call a dependency at the same time", async () => {
    const { stdout } = await runInProcess(TASKS, "parallel")

    expect(stdout).toBe("ran setup\nran lint\nran build")
  })

  it("should fail again without rerunning when a failed task is called again", async () => {
    const { stdout, stderr, errorMessage, exitCode } = await runInProcess(TASKS, "retry")

    expect(exitCode).toBe(8)
    expect(stdout).toBe("ran flaky\ncaught flaky")
    expect(stderr).toBe("exit 8")
    expect(errorMessage).toBe("task 'flaky' failed with exit code 8")
  })
})

describe("hooks", () => {
  it("should run hooks in the order they were added", async () => {
    const { stdout } = await runInProcess(TASKS, "compile")

    expect(stdout).toBe("ran clean\nran before hook\nran compile\nran after hook")
  })

  it("should run hooks once when another task calls the task", async () => {
    const { stdout } = await runInProcess(TASKS, "release")

    expect(stdout).toBe("ran clean\nran before hook\nran compile\nran after hook\nran release")
  })

  it("should name the task when its hook fails", async () => {
    const { stdout, errorMessage, exitCode } = await runInProcess(TASKS, "deploy")

    expect(exitCode).toBe(6)
    expect(stdout).toBe("ran deploy")
    expect(errorMessage).toBe("task 'deploy' failed with exit code 6")
  })

  it("should name the hook when a hook that's a task fails", async () => {
    const { errorMessage, exitCode } = await runInProcess(TASKS, "publish")

    expect(exitCode).toBe(7)
    expect(errorMessage).toBe("task 'verify' failed with exit code 7")
  })

  it.each(["late-before", "late-after"])(
    "should throw when a hook is added to a task that has started: %s",
    async (name) => {
      const { stdout, thrownMessage } = await runInProcess(TASKS, name)

      expect(thrownMessage).toBe("Can't add a hook to a task that has already started")
      expect(stdout).not.toContain("ran late hook")
    },
  )

  it("should run hooks on the built-in list task", async () => {
    const { stdout } = await runInProcess(path.join(FIXTURES, "list-hooks.ts"), "-l")

    expect(stdout).toBe("Available tasks:\n    build\n\nRun `bask <task>` to run a task.")
  })
})

describe("task()", () => {
  it("should throw without a callback", async () => {
    const { thrownMessage } = await runInProcess(path.join(FIXTURES, "missing-callback.ts"), "build")

    expect(thrownMessage).toBe("task() needs a callback")
  })
})
