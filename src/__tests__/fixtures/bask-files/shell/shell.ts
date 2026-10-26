import { task } from "@adamhl8/bask"

export const tolerant = task(async ({ sh }) => {
  await sh`exit 3`.nothrow()
  console.log("kept going")
})

export const shellNothrow = task(async ({ sh }) => {
  sh.nothrow()
  await sh`exit 3`
  await sh`exit 4`
  console.log("kept going")
})

export const throwsToggle = task(async ({ sh }) => {
  sh.throws(false)
  await sh`exit 3`
  console.log("kept going")
  await sh`exit 5`.throws(true)
})

export const echo = task(async ({ sh }) => {
  await sh`echo one`
  await sh`echo two`.echo(false)
  sh.echo(false)
  await sh`echo three`
  await sh`echo four`.echo(true)
})

export const text = task(async ({ sh }) => {
  const output = await sh`echo hidden`.text()
  console.log(`got ${output.trim()}`)
})

export const escaping = task(async ({ sh }) => {
  await sh`echo ${["a b.txt", "c.txt"]}`
  await sh`echo ${"it's here"}`
  await sh`echo ${{ raw: "one   two" }}`
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

export const env = task(async ({ sh }) => {
  sh.echo(false)
  sh.env({ GREETING: "hi" })
  await sh`echo greeting=$GREETING home=$HOME`
  await sh`echo greeting=$GREETING`.env({ GREETING: "hello" })
  await sh`echo greeting=$GREETING home=$HOME`.env({ HOME: undefined })
})

const configure = task(({ sh }) => {
  sh.cwd("/").env({ GREETING: "from another task" }).echo(false)
})

export const isolated = task(async ({ sh }) => {
  await configure()
  await sh`echo greeting=$GREETING`
  await sh`pwd`
})

isolated.before(({ sh }) => {
  sh.cwd("/").env({ GREETING: "from a hook" }).echo(false)
})

export const quiet = task(async ({ sh }) => {
  await sh`echo hidden`.quiet()
  console.log("done")
})

export const reset = task(async ({ sh }) => {
  sh.echo(false)
  sh.cwd("/").env({ GREETING: "hi" })
  sh.cwd().env()
  await sh`echo greeting=$GREETING`
  await sh`pwd`
})

process.env["LOADED"] = "at load"

export const processEnv = task(async ({ sh }) => {
  process.env["GREETING"] = "set later"
  await sh`echo greeting=$GREETING loaded=$LOADED`.echo(false)
  await sh`echo greeting=$GREETING`.env(process.env).echo(false)
})

export const json = task(async ({ sh }) => {
  const data: unknown = await sh`echo ${'{"name":"bask"}'}`.json()
  console.log(JSON.stringify(data))
})

export const lines = task(async ({ sh }) => {
  for await (const line of sh`printf '%s\n%s' a b`.lines()) console.log(`line=${line}`)
})

export const catchFinally = task(async ({ sh }) => {
  await sh`exit 3`.catch(() => {
    console.log("caught")
  })
  await sh`echo done`.finally(() => {
    console.log("finally")
  })
})

export const bunToggle = task(async ({ sh }) => {
  sh.echo(false)
  await sh`runtime`
  await sh`runtime`.bun(false)
  sh.bun(false)
  await sh`runtime`
  await sh`runtime`.bun(true)
})

export const bunEnv = task(async ({ sh }) => {
  await sh`runtime`.env({ GREETING: "hi" }).echo(false)
})

export const bunOff = task(async ({ sh }) => {
  await sh`runtime`.bun(false).echo(false)
})

export const arrayBuffer = task(async ({ sh }) => {
  const output = await sh`echo hidden`.arrayBuffer()
  console.log(`got ${new TextDecoder().decode(output).trim()}`)
})

export const blob = task(async ({ sh }) => {
  const output = await sh`echo hidden`.blob()
  console.log(`got ${(await output.text()).trim()}`)
})

export const awaitTwice = task(async ({ sh }) => {
  const command = sh`echo once`
  await command
  await command
})

export const noPath = task(async ({ sh }) => {
  sh.echo(false).env({ PATH: undefined })
  await sh`echo path=$PATH`
  await sh`echo path=$PATH`.bun(false)
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
