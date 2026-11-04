import { describe, expect, it } from "bun:test"
import path from "node:path"

import { runInProcess } from "#__tests__/utils.ts"

const FIXTURES = path.join(import.meta.dir, "fixtures/run-bask")
const TASKS = path.join(FIXTURES, "tasks.ts")
const NO_DEFAULT = path.join(FIXTURES, "no-default.ts")
const FAILURES = path.join(FIXTURES, "failures.ts")

const TASK_LIST = `Available tasks:
    build     # Build the project [default] [alias: b]
    bump-deps # [aliases: up, update-deps]
    lint`

describe("running tasks", () => {
  it.each(["bump-deps", "bumpDeps"])("should run a task by its name: %s", async (name) => {
    const { stdout } = await runInProcess(TASKS, name)

    expect(stdout).toBe("ran bump-deps")
  })

  it.each(["up", "update-deps", "updateDeps"])("should run a task by its alias: %s", async (alias) => {
    const { stdout } = await runInProcess(TASKS, alias)

    expect(stdout).toBe("ran bump-deps")
  })

  it("should run a hidden task", async () => {
    const { stdout } = await runInProcess(TASKS, "release-run")

    expect(stdout).toBe("ran release-run")
  })

  it("should run the default task when no task is named", async () => {
    const { stdout } = await runInProcess(TASKS)

    expect(stdout).toBe("ran build")
  })

  it("should list the tasks when no task is named and there's no default", async () => {
    const { stdout } = await runInProcess(NO_DEFAULT)

    expect(stdout).toBe("Available tasks:\n    lint")
  })

  it.each(["-l", "--list"])("should list the tasks with %s", async (flag) => {
    const { stdout } = await runInProcess(TASKS, flag)

    expect(stdout).toBe(TASK_LIST)
  })

  it("should run the default task by the name 'default'", async () => {
    const { stdout } = await runInProcess(TASKS, "default")

    expect(stdout).toBe("ran build")
  })

  it("should list and run a task that's only the default export", async () => {
    const baskPath = path.join(FIXTURES, "default-only.ts")

    const { stdout: taskList } = await runInProcess(baskPath, "-l")
    const { stdout: output } = await runInProcess(baskPath)

    expect(taskList).toBe("Available tasks:\n    default\n    lint")
    expect(output).toBe("ran deploy")
  })

  it.each(["no-tasks.ts", "hidden-only.ts"])("should list no tasks when there are none to show: %s", async (file) => {
    const { stdout } = await runInProcess(path.join(FIXTURES, file))

    expect(stdout).toBe("Available tasks:")
  })
})

describe("failures", () => {
  it("should fail on an unknown task", async () => {
    const { errorMessage } = await runInProcess(TASKS, "nope")

    expect(errorMessage).toBe(`unknown task 'nope'\n\n${TASK_LIST}`)
  })

  it("should fail on 'default' when there's no default task", async () => {
    const { errorMessage } = await runInProcess(NO_DEFAULT, "default")

    expect(errorMessage).toBe("unknown task 'default'\n\nAvailable tasks:\n    lint")
  })

  it("should fail with exit code 2 on an unknown flag", async () => {
    const { errorMessage, exitCode } = await runInProcess(TASKS, "--nope")

    expect(errorMessage).toStartWith("Unknown option '--nope'")
    expect(exitCode).toBe(2)
  })

  it("should fail without a bask.ts", async () => {
    const { errorMessage } = await runInProcess(path.join(FIXTURES, "missing/bask.ts"))

    expect(errorMessage).toBe(`no bask.ts in ${path.join(FIXTURES, "missing")}`)
  })

  it("should report the failed command's exit code", async () => {
    const { stderr, errorMessage, exitCode } = await runInProcess(FAILURES, "fail")

    expect(exitCode).toBe(3)
    expect(stderr).toBe("exit 3")
    expect(errorMessage).toBe("task 'fail' failed with exit code 3")
  })

  it("should name the task, not the alias it ran under", async () => {
    const { errorMessage } = await runInProcess(FAILURES, "f")

    expect(errorMessage).toBe("task 'fail' failed with exit code 3")
  })

  it("should name the dependency that failed", async () => {
    const { errorMessage, exitCode } = await runInProcess(FAILURES, "build")

    expect(exitCode).toBe(4)
    expect(errorMessage).toBe("task 'compile' failed with exit code 4")
  })

  it("should name the task that was run when the failed task isn't exported", async () => {
    const { errorMessage, exitCode } = await runInProcess(FAILURES, "deploy")

    expect(exitCode).toBe(5)
    expect(errorMessage).toBe("task 'deploy' failed with exit code 5")
  })

  it("should rethrow an error that isn't a failed command", async () => {
    const { thrownMessage } = await runInProcess(FAILURES, "crash")

    expect(thrownMessage).toBe("task bug")
  })

  it.each([
    ["with", "top-level-call.ts"],
    ["without", "top-level-call-unawaited.ts"],
  ])("should fail when bask.ts runs a task at its top level %s await", async (_, file) => {
    const { errorMessage } = await runInProcess(path.join(FIXTURES, file), "build")

    expect(errorMessage).toBe(
      "a task ran while bask.ts was loading. Call tasks from inside other tasks, not at the top level.",
    )
  })
})
