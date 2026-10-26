import { afterAll, beforeAll } from "bun:test"

import { packBask, removeTempDirs } from "#__tests__/utils.ts"

beforeAll(async () => {
  void console.write("Building bask...")
  await packBask()
  void console.write("done\n")
  void console.write("Running tests...\n")
}, 60_000)

afterAll(removeTempDirs)
