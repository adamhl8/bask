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

describe("args", () => {
  const ARGS = path.join(FIXTURES, "args.ts")

  it("should give the named task its args, and its hooks too", async () => {
    const { stdout } = await runInProcess(ARGS, "test", "-w", "--timeout", "9", "a.ts")

    expect(stdout).toBe("before test watch=true positionals=a.ts\nran test watch=true timeout=9 positionals=a.ts")
  })

  it("should give a task run as a dependency empty args", async () => {
    const { stdout } = await runInProcess(ARGS, "ci")

    expect(stdout).toBe("before test watch=false positionals=\nran test watch=false timeout=undefined positionals=")
  })

  it("should give a task used as a hook empty args", async () => {
    const { stdout } = await runInProcess(ARGS, "deploy", "--env", "prod")

    expect(stdout).toBe("ran clean all=false\nran deploy env=prod")
  })
})

describe("cycles", () => {
  const CYCLES = path.join(FIXTURES, "cycles.ts")

  it.each([
    ["when a task calls itself", "self-call", "Task 'self-call' calls itself: self-call -> self-call"],
    ["when a hook calls its own task", "hooked", "Task 'hooked' calls itself: hooked -> hooked"],
    ["on a cycle through other tasks", "first", "Task 'first' calls itself: first -> second -> first"],
    [
      "naming only the cycle when it starts partway down",
      "outer",
      "Task 'first' calls itself: first -> second -> first",
    ],
    [
      "on a cycle between tasks that started at the same time",
      "concurrent",
      "Task 'slow-cycle' calls itself: slow-cycle -> fast-cycle -> slow-cycle",
    ],
  ])("should throw %s", async (_, taskName, message) => {
    const { thrownMessage } = await runInProcess(CYCLES, taskName)

    expect(thrownMessage).toBe(message)
  })

  it("should let code started inside a task's run call the task after the run finished", async () => {
    const { stdout, thrownMessage } = await runInProcess(CYCLES, "after-finished")

    expect(thrownMessage).toBeUndefined()
    expect(stdout).toBe("ran finished\nlate call joined")
  })
})

describe("wrap", () => {
  const WRAP = path.join(FIXTURES, "wrap.ts")

  it.each([
    [
      "wrap the hooks added before it, and run hooks added after it around the wrap",
      ["build", "-r", "-w"],
      "wrap start release=true watch=true\nbefore build\nran build watch=true\nafter build\nwrap end\nafter hook release=true",
    ],
    [
      "append hooks to the layer the last wrap started",
      ["layered"],
      "outer before\nwrap start\nfirst before\nsecond before\nran layered\nfirst after\nwrap end\nouter after",
    ],
    ["replace the task when the wrap skips the original", ["skipped"], "replaced skipped"],
    [
      "stack wraps with the last one outermost",
      ["stacked"],
      "outer start\ninner start\nran stacked\ninner end\nouter end",
    ],
    ["run the original each time it's called", ["twice"], "ran twice\nran twice"],
    ["give the original its own shell", ["shelled"], "X="],
    [
      "give a wrapped task run as a dependency empty args",
      ["ci"],
      "wrap start release=false watch=false\nbefore build\nran build watch=false\nafter build\nwrap end\nafter hook release=false",
    ],
  ])("should %s", async (_, args, output) => {
    const { stdout } = await runInProcess(WRAP, ...args)

    expect(stdout).toBe(output)
  })

  it("should add a wrap's args only to the wrapped task when tasks share an options object", async () => {
    const sharedOptions = path.join(FIXTURES, "wrap-shared-options.ts")

    const { stdout } = await runInProcess(sharedOptions, "dev", "--port", "3000")
    const { stderr, exitCode } = await runInProcess(sharedOptions, "test", "--port", "3000")

    expect(stdout).toBe("ran dev watch=false\nport=3000")
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Unexpected option or argument: "--port"')
  })

  it("should throw when wrapping a task that has started", async () => {
    const { stdout, thrownMessage } = await runInProcess(WRAP, "late-wrap")

    expect(thrownMessage).toBe("Can't wrap a task that has already started")
    expect(stdout).not.toContain("ran late wrap")
  })

  it("should throw when a wrap calls its own task", async () => {
    const { thrownMessage } = await runInProcess(WRAP, "self-wrap")

    expect(thrownMessage).toBe("Task 'self-wrap' calls itself: self-wrap -> self-wrap")
  })

  it("should throw on an arg name the task already has", async () => {
    const { thrownMessage } = await runInProcess(path.join(FIXTURES, "wrap-duplicate-arg.ts"), "build")

    expect(thrownMessage).toBe("Can't add arg 'watch' with wrap() because the task already has it")
  })

  it("should throw without a callback", async () => {
    const { thrownMessage } = await runInProcess(path.join(FIXTURES, "wrap-missing-callback.ts"), "build")

    expect(thrownMessage).toBe("wrap() needs a callback")
  })

  it("should wrap the built-in list task", async () => {
    const { stdout } = await runInProcess(path.join(FIXTURES, "list-wrap.ts"), "-l")

    expect(stdout).toBe("before list\nAvailable tasks:\n    build")
  })
})

describe("task()", () => {
  it("should throw without a callback", async () => {
    const { thrownMessage } = await runInProcess(path.join(FIXTURES, "missing-callback.ts"), "build")

    expect(thrownMessage).toBe("task() needs a callback")
  })
})
