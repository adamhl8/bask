import { describe, expect, it } from "bun:test"
import path from "node:path"

import { runInProcess } from "#__tests__/utils.ts"

const FIXTURES = path.join(import.meta.dir, "fixtures")

describe("bask.ts validation", () => {
  it.each([
    [
      "a default export that isn't a task",
      "default-not-task.ts",
      "the default export isn't a task. Wrap it in task().",
    ],
    [
      "a task exported twice",
      "exported-twice.ts",
      "task 'compile' is also exported as 'build'. Use the alias option instead.",
    ],
    [
      "a 'default' alias",
      "alias-default.ts",
      "task 'build' can't use 'default' as an alias. Export it as the default instead.",
    ],
    [
      "a 'default' alias on a task that's only the default export",
      "default-alias-default.ts",
      "task 'default' can't use 'default' as an alias. Export it as the default instead.",
    ],
    [
      "a 'default' alias on a named task that's also the default export",
      "named-default-alias-default.ts",
      "task 'build' can't use 'default' as an alias. Export it as the default instead.",
    ],
    [
      "an alias that's another task's name",
      "alias-taken-by-name.ts",
      "task 'update' has alias 'bump-deps', which task 'bumpDeps' already uses",
    ],
    [
      "an alias that's another task's alias",
      "alias-taken-by-alias.ts",
      "task 'upgrade' has alias 'updateDeps', which task 'bumpDeps' already uses",
    ],
    [
      "a baskConfig not made with defineConfig",
      "config-not-defined.ts",
      "baskConfig isn't a config. Wrap it in defineConfig().",
    ],
  ])("should fail on %s", async (_, file, message) => {
    const { errorMessage } = await runInProcess(path.join(FIXTURES, file))

    expect(errorMessage).toBe(message)
  })

  it("should report every problem at once", async () => {
    const { errorMessage } = await runInProcess(path.join(FIXTURES, "many-problems.ts"))

    expect(errorMessage).toBe(`bask.ts has 3 problems:
  the default export isn't a task. Wrap it in task().
  task 'compile' is also exported as 'build'. Use the alias option instead.
  task 'build' can't use 'default' as an alias. Export it as the default instead.`)
  })

  it("should allow an alias that repeats the task's own name", async () => {
    const baskPath = path.join(FIXTURES, "alias-repeats-name.ts")

    const { stdout: taskList } = await runInProcess(baskPath, "-l")
    const { stdout: output } = await runInProcess(baskPath, "b")

    expect(taskList).toBe("Available tasks:\n    build # [alias: b]")
    expect(output).toBe("ran build")
  })

  it("should ignore exports that aren't tasks", async () => {
    const baskPath = path.join(FIXTURES, "non-task-exports.ts")

    const { stdout: taskList } = await runInProcess(baskPath, "-l")
    const { errorMessage } = await runInProcess(baskPath, "helper")

    expect(taskList).toBe("Available tasks:\n    build")
    expect(errorMessage).toStartWith("unknown task 'helper'")
  })
})
