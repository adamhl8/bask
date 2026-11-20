import { task } from "@adamhl8/bask"

export const echo = task(async ({ sh }) => {
  await sh`echo one`
  await sh`echo two`.echo(false)
  sh.echo(false)
  await sh`echo three`
  await sh`echo four`.echo(true)
})

export const cwd = task(async ({ sh }) => {
  sh.echo(false)
  await sh`mkdir -p sub/inner`
  sh.cwd("sub")
  await sh`pwd`
  sh.cwd("sub/inner")
  await sh`pwd`
  await sh`pwd`.cwd(".")
})

export const bunOff = task(async ({ sh }) => {
  await sh`runtime`.bun(false).echo(false)
})

export const nodePath = task(async ({ sh }) => {
  await sh`which node`.echo(false)
})

// Print which of stdin, stdout, and stderr are a terminal, and what `FORCE_COLOR` is.
const PROBE = String.raw`for fd in 0 1 2; do if [ -t $fd ]; then printf '%s=tty ' $fd; else printf '%s=pipe ' $fd; fi; done; echo "color=$FORCE_COLOR"`

export const terminal = task(async ({ sh }) => {
  sh.echo(false)
  await sh`sh -c ${PROBE}`
  console.log(`text: ${(await sh`sh -c ${PROBE}`.text()).trim()}`)
  const { stdout } = await sh`sh -c ${PROBE}`.quiet()
  console.log(`quiet: ${stdout.trim()}`)
})

export const textStderr = task(async ({ sh }) => {
  const output = await sh`sh -c ${"echo out; echo warn >&2"}`.echo(false).text()
  console.log(`got ${output.trim()}`)
  await sh`sh -c ${"echo hidden; echo hidden warn >&2"}`.echo(false).quiet()
})
