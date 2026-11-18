import { task } from "#task.ts"

const watchable = { args: { watch: { short: "w" } } } as const

export const test = task(watchable, ({ args }) => {
  console.log(`ran test watch=${args.watch}`)
})

export const dev = task(watchable, ({ args }) => {
  console.log(`ran dev watch=${args.watch}`)
})

dev.wrap({ args: { port: { type: "string" } } }, async ({ args, original }) => {
  await original()
  console.log(`port=${String(args.port)}`)
})
