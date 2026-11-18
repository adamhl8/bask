import { task } from "#task.ts"

export const build = task({ desc: "Build", args: { watch: { short: "w" } } }, () => {
  console.log("ran build")
})

build.wrap({ args: { release: { short: "r", desc: "Build for release" } } }, async ({ original }) => {
  await original()
})
