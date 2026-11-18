import { task } from "#task.ts"

export const build = task({ desc: "Build", args: { watch: { short: "w" } } }, () => {
  console.log("ran build")
})

build.wrap({ args: { wide: { short: "w" } } }, async ({ original }) => {
  await original()
})
