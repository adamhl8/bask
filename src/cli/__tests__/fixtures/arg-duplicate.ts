import { task } from "#task.ts"

export const build = task({ args: { watch: { short: "w" }, wide: { short: "w" } } }, () => {
  console.log("ran build")
})
