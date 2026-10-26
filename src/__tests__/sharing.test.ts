import { describe, expect, it, setDefaultTimeout } from "bun:test"

import { createProject } from "#__tests__/utils.ts"

setDefaultTimeout(30_000)

describe("sharing tasks", () => {
  it("lists re-exported tasks alongside the local ones", async () => {
    const { run } = await createProject({ baskFile: "sharing/re-exports" })

    const { all } = await run`bask -l`

    expect(all).toBe("Available tasks:\n    build  # [default]\n    bundle\n    lint\n    sync")
  })

  it("runs a hook on a shared task when another shared task calls it", async () => {
    const { run } = await createProject({ baskFile: "sharing/re-exports" })

    const { all } = await run`bask build`

    expect(all).toBe("ran sync\nran lint\nran build\nran bundle")
  })

  it("runs a default re-exported by name", async () => {
    const { run } = await createProject({ baskFile: "sharing/re-exports" })

    const { all } = await run`bask`

    expect(all).toBe("ran sync\nran lint\nran build\nran bundle")
  })

  it("doesn't re-export the default with export *", async () => {
    const { run } = await createProject({ baskFile: "sharing/no-default" })

    const { all } = await run`bask`

    expect(all).toBe("Available tasks:\n    build\n    lint")
  })

  it("applies a baskConfig re-exported with export *", async () => {
    const { run } = await createProject({ baskFile: "sharing/config" })

    const { stdout, stderr } = await run`bask hello`

    expect(stdout).toBe("hi")
    expect(stderr).toBe("")
  })

  it("replaces a re-exported baskConfig with a local one", async () => {
    const { run } = await createProject({ baskFile: "sharing/config-override" })

    const { stdout, stderr } = await run`bask hello`

    expect(stdout).toBe("hi")
    expect(stderr).toBe("echo hi")
  })
})
