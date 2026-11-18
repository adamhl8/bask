import { task } from "#task.ts"

const clean = task({ args: { all: {} } }, () => {
  console.log("ran clean")
})

export const typed = task(
  { args: { watch: { short: "w" }, timeout: { type: "string" } }, positionals: true },
  ({ args, positionals }) => {
    const watch: boolean = args.watch
    const timeout: string | undefined = args.timeout
    const files: string[] = positionals
    console.log(watch, timeout, files)

    // @ts-expect-error `nope` isn't a declared arg
    console.log(args.nope)
    // @ts-expect-error `timeout` is a string arg
    const wrong: boolean = args.timeout
    console.log(wrong)
  },
)

// @ts-expect-error tasks take no args from code
void typed({ watch: true })

typed.before(clean)
typed.before(({ args }) => {
  const watch: boolean = args.watch
  console.log(watch)
})

const wrapped = typed.wrap({ args: { release: { short: "r" } } }, ({ args, original }) => {
  const release: boolean = args.release
  const watch: boolean = args.watch
  const callOriginal: () => Promise<void> = original
  console.log(release, watch, callOriginal)
  // @ts-expect-error `nope` isn't a declared arg
  console.log(args.nope)
})

wrapped.after(({ args }) => {
  const release: boolean = args.release
  console.log(release)
})

typed.wrap({}, ({ args }) => {
  // Use brackets because `noPropertyAccessFromIndexSignature` rejects `args.nope` even on a loose type.
  // @ts-expect-error `nope` isn't a declared arg, even when `wrap` adds none
  console.log(args["nope"])
})
