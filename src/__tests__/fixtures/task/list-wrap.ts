import { list } from "#cli/list.ts"
import { task } from "#task.ts"

export const build = task(() => {
  console.log("ran build")
})

list.wrap(async ({ original }) => {
  console.log("before list")
  await original()
})
