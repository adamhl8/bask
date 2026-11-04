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

export const color = task(async ({ sh }) => {
  sh.echo(false)
  await sh`echo color=$FORCE_COLOR`
  const quietColor = await sh`echo $FORCE_COLOR`.text()
  console.log(`quiet=${quietColor.trim()}`)
  await sh`echo no-color=$FORCE_COLOR`.env({ NO_COLOR: "1" })
  await sh`echo forced=$FORCE_COLOR`.env({ FORCE_COLOR: "0" })
})
