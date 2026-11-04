import { describe, expect, it } from "bun:test"
import path from "node:path"

import { runInProcess } from "#__tests__/utils.ts"

const FIXTURES = path.join(import.meta.dir, "fixtures/sharing")
const RE_EXPORTS = path.join(FIXTURES, "re-exports/bask.ts")

describe("sharing tasks", () => {
  it("should list re-exported tasks alongside the local ones", async () => {
    const { stdout } = await runInProcess(RE_EXPORTS, "-l")

    expect(stdout).toBe("Available tasks:\n    build  # [default]\n    bundle\n    lint\n    sync")
  })

  it("should run a hook on a shared task when another shared task calls it", async () => {
    const { stdout } = await runInProcess(RE_EXPORTS, "build")

    expect(stdout).toBe("ran sync\nran lint\nran build\nran bundle")
  })

  it("should run a default re-exported by name", async () => {
    const { stdout } = await runInProcess(RE_EXPORTS)

    expect(stdout).toBe("ran sync\nran lint\nran build\nran bundle")
  })

  it("should not re-export the default with export *", async () => {
    const { stdout } = await runInProcess(path.join(FIXTURES, "no-default/bask.ts"))

    expect(stdout).toBe("Available tasks:\n    build\n    lint")
  })

  it("should apply a baskConfig re-exported with export *", async () => {
    const { stdout, stderr } = await runInProcess(path.join(FIXTURES, "config/bask.ts"), "hello")

    expect(stdout).toBe("hi")
    expect(stderr).toBe("")
  })

  it("should replace a re-exported baskConfig with a local one", async () => {
    const { stdout, stderr } = await runInProcess(path.join(FIXTURES, "config-override/bask.ts"), "hello")

    expect(stdout).toBe("hi")
    expect(stderr).toBe("echo hi")
  })
})
