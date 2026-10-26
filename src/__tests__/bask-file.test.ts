import { describe, expect, it, setDefaultTimeout } from "bun:test"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

describe("bask.ts validation", () => {
  it.each([
    [
      "a default export that isn't a task",
      "bask-file/default-not-task.ts",
      "the default export isn't a task. Wrap it in task().",
    ],
    [
      "a task exported twice",
      "bask-file/exported-twice.ts",
      "task 'compile' is also exported as 'build'. Use the alias option instead.",
    ],
    [
      "a 'default' alias",
      "bask-file/alias-default.ts",
      "task 'build' can't use 'default' as an alias. Export it as the default instead.",
    ],
    [
      "a 'default' alias on a task that's only the default export",
      "bask-file/default-alias-default.ts",
      "task 'default' can't use 'default' as an alias. Export it as the default instead.",
    ],
    [
      "a 'default' alias on a named task that's also the default export",
      "bask-file/named-default-alias-default.ts",
      "task 'build' can't use 'default' as an alias. Export it as the default instead.",
    ],
    [
      "an alias that's another task's name",
      "bask-file/alias-taken-by-name.ts",
      "task 'update' has alias 'bump-deps', which task 'bumpDeps' already uses",
    ],
    [
      "an alias that's another task's alias",
      "bask-file/alias-taken-by-alias.ts",
      "task 'upgrade' has alias 'updateDeps', which task 'bumpDeps' already uses",
    ],
    [
      "a baskConfig not made with defineConfig",
      "bask-file/config-not-defined.ts",
      "baskConfig isn't a config. Wrap it in defineConfig().",
    ],
  ])("fails on %s", async (_, baskFile, message) => {
    const { run } = await createProject({ baskFile })

    const { all, exitCode } = await run({ reject: false })`bask`

    expect(exitCode).toBe(1)
    expect(all).toBe(`error: ${message}`)
  })

  it("reports every problem at once", async () => {
    const { run } = await createProject({ baskFile: "bask-file/many-problems.ts" })

    const { all, exitCode } = await run({ reject: false })`bask`

    expect(exitCode).toBe(1)
    expect(all).toBe(`error: bask.ts has 3 problems:
  the default export isn't a task. Wrap it in task().
  task 'compile' is also exported as 'build'. Use the alias option instead.
  task 'build' can't use 'default' as an alias. Export it as the default instead.`)
  })

  it("allows an alias that repeats the task's own name", async () => {
    const { run } = await createProject({ baskFile: "bask-file/alias-repeats-name.ts" })

    const { all: list } = await run`bask -l`
    const { all: output } = await run`bask b`

    expect(list).toBe("Available tasks:\n    build # [alias: b]")
    expect(output).toBe("ran build")
  })

  it("ignores exports that aren't tasks", async () => {
    const { run } = await createProject({ baskFile: "bask-file/non-task-exports.ts" })

    const { all: list } = await run`bask -l`
    const { exitCode } = await run({ reject: false })`bask helper`

    expect(list).toBe("Available tasks:\n    build")
    expect(exitCode).toBe(1)
  })
})
