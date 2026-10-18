import { task } from "@adamhl8/bask"

import { build, lint } from "./shared-tasks.ts"

export * from "./shared-tasks.ts"
export { default } from "./shared-tasks.ts"

export const sync = task(() => {
  console.log("ran sync")
})

export const bundle = task(() => {
  console.log("ran bundle")
})

lint.before(sync)
build.after(bundle)
