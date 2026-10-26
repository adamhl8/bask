import { beforeAll } from "bun:test"

import { packBask } from "#__tests__/utils.ts"

import "@adamhl8/configs/test/preload"

beforeAll(async () => {
  void console.write("Building bask...")
  await packBask()
  void console.write("done\n")
  void console.write("Running tests...\n")
}, 60_000)
