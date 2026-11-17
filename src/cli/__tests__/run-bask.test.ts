import { describe, expect, it } from "bun:test"
import path from "node:path"

import { runInProcess } from "#__tests__/utils.ts"

const FIXTURES = path.join(import.meta.dir, "fixtures")
const TASKS = path.join(FIXTURES, "tasks.ts")
const NO_DEFAULT = path.join(FIXTURES, "no-default.ts")
const FAILURES = path.join(FIXTURES, "failures.ts")

const WATCH_HELP_LINE = /^ {2}-w, --watch +Rerun when files change$/mv

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
  it.each([
    ["tasks.ts", "nope"],
    ["no-default.ts", "default"],
  ])("should print Optique's error and exit with code 2 on an unknown task: %s %s", async (file, name) => {
    const { stderr, errorMessage, exitCode } = await runInProcess(path.join(FIXTURES, file), name)

    expect(exitCode).toBe(2)
    expect(errorMessage).toBeUndefined()
    expect(stderr).toContain(`Unknown task "${name}". Run \`bask --list\` to see the tasks.`)
  })

  it("should report an unknown task when bask.ts has no tasks", async () => {
    const { stderr, exitCode, thrownMessage } = await runInProcess(path.join(FIXTURES, "no-tasks.ts"), "foo")

    expect(thrownMessage).toBeUndefined()
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Unknown task "foo"')
  })

  it("should print Optique's error and exit with code 2 on an unknown flag", async () => {
    const { stderr, errorMessage, exitCode } = await runInProcess(TASKS, "--nope")

    expect(exitCode).toBe(2)
    expect(errorMessage).toBeUndefined()
    expect(stderr).toContain('Error: Unexpected option or argument: "--nope".')
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

describe("task args", () => {
  const ARGS = path.join(FIXTURES, "args.ts")
  const EMPTY = { watch: false, timeout: "undefined", lines: false, dryRun: false }

  /** Runs `args.ts` and returns the args its `test` task logged. */
  const runTestTask = async (...args: string[]): Promise<unknown> => {
    const { stdout } = await runInProcess(ARGS, ...args)
    return JSON.parse(stdout)
  }

  it("should pass args and positionals to the task", async () => {
    expect(await runTestTask("test", "-w", "--timeout", "10", "--dry-run", "src/a.ts")).toStrictEqual({
      args: { ...EMPTY, watch: true, timeout: "10", dryRun: true },
      positionals: ["src/a.ts"],
    })
  })

  it("should give absent booleans false and absent strings undefined", async () => {
    expect(await runTestTask("test")).toStrictEqual({ args: EMPTY, positionals: [] })
  })

  it("should pass everything after -- as positionals", async () => {
    expect(await runTestTask("test", "--", "--bail", "-w")).toStrictEqual({
      args: EMPTY,
      positionals: ["--bail", "-w"],
    })
  })

  it("should give flags after the task name to the task", async () => {
    expect(await runTestTask("test", "-l")).toStrictEqual({ args: { ...EMPTY, lines: true }, positionals: [] })
  })

  it.each(["default", "t"])("should pass args to the task run as %s", async (name) => {
    expect(await runTestTask(name, "-w")).toStrictEqual({ args: { ...EMPTY, watch: true }, positionals: [] })
  })

  it("should show task args in the task list", async () => {
    const { stdout } = await runInProcess(ARGS, "-l")

    expect(stdout).toBe(`Available tasks:
    lint
    test # Run tests [default] [alias: t] [-w/--watch] [--timeout VALUE] [-l/--lines] [--dry-run] [ARG...]`)
  })

  it("should list the tasks and ignore task args when -l comes first", async () => {
    const { stdout, errorMessage } = await runInProcess(ARGS, "-l", "test", "-w")

    expect(errorMessage).toBeUndefined()
    expect(stdout).toStartWith("Available tasks:")
  })

  it.each([
    ["test --wach", 'Error: Unexpected option or argument: "--wach".'],
    ["test --timeout", "Error: `--timeout` requires `VALUE`."],
    ["lint foo", 'Error: Unexpected option or argument: "foo".'],
    ["lint --fix", 'Error: Unexpected option or argument: "--fix".'],
  ])("should print Optique's error and exit with code 2 on bad task args: %s", async (argv, message) => {
    const [taskName = ""] = argv.split(" ")
    const { stderr, errorMessage, exitCode } = await runInProcess(ARGS, ...argv.split(" "))

    expect(exitCode).toBe(2)
    expect(errorMessage).toBeUndefined()
    expect(stderr).toStartWith(`Usage: bask ${taskName}`)
    expect(stderr).toContain(message)
  })
})

describe("bask's own args and help", () => {
  const ARGS = path.join(FIXTURES, "args.ts")
  const MISSING_DIR = path.join(FIXTURES, "missing")

  it("should treat flags before the task name as bask's own", async () => {
    const { stderr, exitCode } = await runInProcess(ARGS, "-w", "test")

    expect(exitCode).toBe(2)
    expect(stderr).toContain('"-w"')
  })

  it("should print bask's help and the task list", async () => {
    const { stdout, exitCode } = await runInProcess(TASKS, "-h")

    expect(exitCode).toBe(0)
    expect(stdout).toStartWith("Usage: bask")
    expect(stdout).toContain("-l, --list")
    expect(stdout).toEndWith(`Run \`bask -h <task>\` to see a task's args.\n\n${TASK_LIST}`)
  })

  it("should print a task's help page", async () => {
    const { stdout, exitCode } = await runInProcess(ARGS, "-h", "test")

    expect(exitCode).toBe(0)
    expect(stdout).toStartWith("Run tests\nUsage: bask test")
    expect(stdout).toMatch(WATCH_HELP_LINE)
  })

  it("should print a help page for a task with no description or args", async () => {
    const { stdout, exitCode } = await runInProcess(ARGS, "-h", "lint")

    expect(exitCode).toBe(0)
    expect(stdout).toBe("Usage: bask lint")
  })

  it("should fail help for an unknown task", async () => {
    const { stderr, exitCode } = await runInProcess(TASKS, "-h", "nope")

    expect(exitCode).toBe(2)
    expect(stderr).toContain('Unknown task "nope"')
  })

  it("should leave -h after the task name to the task", async () => {
    const { stderr, exitCode } = await runInProcess(ARGS, "test", "-h")

    expect(exitCode).toBe(2)
    expect(stderr).toContain('"-h"')
  })

  it("should print help without a bask.ts", async () => {
    const { stdout, errorMessage } = await runInProcess(path.join(MISSING_DIR, "bask.ts"), "-h")

    expect(stdout).toStartWith("Usage: bask")
    expect(errorMessage).toBe(`no bask.ts in ${MISSING_DIR}`)
  })

  it("should report a bad bask flag without a bask.ts", async () => {
    const { errorMessage, exitCode } = await runInProcess(path.join(MISSING_DIR, "bask.ts"), "--nope")

    expect(exitCode).toBe(2)
    expect(errorMessage).toBeUndefined()
  })

  it("should print help before a broken bask.ts's problem", async () => {
    const brokenPath = path.resolve(import.meta.dir, "../../bask-file/__tests__/fixtures/exported-twice.ts")

    const { stdout, errorMessage } = await runInProcess(brokenPath, "-h")

    expect(stdout).toStartWith("Usage: bask")
    expect(errorMessage).toBe("task 'compile' is also exported as 'build'. Use the alias option instead.")
  })

  it("should not load bask.ts for a bad bask flag", async () => {
    const logsOnLoadPath = path.resolve(import.meta.dir, "../../__tests__/fixtures/bask-files/logs-on-load.ts")

    const { stdout, exitCode } = await runInProcess(logsOnLoadPath, "--nope")

    expect(exitCode).toBe(2)
    expect(stdout).not.toContain("bask.ts ran")
  })
})

describe("task arg declarations", () => {
  it("should fail on an invalid short", async () => {
    const { errorMessage } = await runInProcess(path.join(FIXTURES, "arg-short-invalid.ts"))

    expect(errorMessage).toBe("task 'build' has arg 'watch' with short 'ww'. A short must be one letter or digit.")
  })

  it("should fail on a flag that two args share", async () => {
    const { errorMessage } = await runInProcess(path.join(FIXTURES, "arg-duplicate.ts"))

    expect(errorMessage).toStartWith("task 'build' has invalid args: ")
  })
})
