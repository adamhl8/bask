import { task } from "@adamhl8/bask"

export const test = task({ args: { watch: { short: "w" } }, positionals: true }, ({ args, positionals }) => {
  console.log(`ran test watch=${args.watch} positionals=${positionals.join(",")}`)
})
