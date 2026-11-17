import { task } from "#task.ts"

export const test = task(
  { args: { watch: { short: "w" }, timeout: { type: "string" } }, positionals: true },
  ({ args, positionals }) => {
    console.log(`ran test watch=${args.watch} timeout=${String(args.timeout)} positionals=${positionals.join(",")}`)
  },
)

test.before(({ args, positionals }) => {
  console.log(`before test watch=${args.watch} positionals=${positionals.join(",")}`)
})

export const clean = task({ args: { all: {} } }, ({ args }) => {
  console.log(`ran clean all=${args.all}`)
})

export const deploy = task({ args: { env: { type: "string" } } }, ({ args }) => {
  console.log(`ran deploy env=${String(args.env)}`)
})

deploy.before(clean)

export const ci = task(async () => {
  await test()
})
