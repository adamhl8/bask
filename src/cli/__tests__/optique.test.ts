import { describe, expect, it } from "bun:test"

import { toOptiqueOutput } from "#cli/optique.ts"

describe("toOptiqueOutput()", () => {
  it("should leave the width to Optique when a terminal reports no width", () => {
    // Build on `process.stderr` because `styleText` only accepts a real stream.
    // oxlint-disable-next-line typescript/no-unsafe-assignment - `Object.create` returns `any`, and this inherits the rest of `process.stderr`
    const sizelessTerminal: NodeJS.WriteStream = Object.create(process.stderr, {
      isTTY: { value: true },
      columns: { value: 0 },
    })

    expect(toOptiqueOutput(sizelessTerminal)).not.toHaveProperty("maxWidth")
  })
})
