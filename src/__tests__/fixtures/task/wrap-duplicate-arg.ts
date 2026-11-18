import { task } from "#task.ts"

export const build = task({ args: { watch: {} } }, () => {
  console.log("ran build")
})

build.wrap({ args: { watch: {} } }, () => {
  console.log("ran wrap")
})
