import { task } from "#task.ts"

export const build = task({ args: { watch: { short: "ww" } } }, () => {
  console.log("ran build")
})
