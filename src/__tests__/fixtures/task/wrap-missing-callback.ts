import { task } from "#task.ts"

export const build = task(() => {
  console.log("ran build")
})

// @ts-expect-error - a missing callback is the mistake under test
build.wrap({ args: { release: {} } })
