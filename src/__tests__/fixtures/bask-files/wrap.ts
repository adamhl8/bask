import { task } from "@adamhl8/bask"

export const build = task(() => {
  console.log("ran build")
})

build.wrap({ args: { release: { short: "r" } } }, async ({ args, original }) => {
  await original()
  console.log(`release=${args.release}`)
})
