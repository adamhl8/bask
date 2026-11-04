import path from "node:path"

import { addRuntimeBinToPath, logOutput } from "#shell/__tests__/fixtures/helpers.ts"
import { task } from "#task.ts"

addRuntimeBinToPath()

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
  await logOutput(sh`echo one`)
  await logOutput(sh`echo two`.echo(false))
  sh.echo(false)
  await logOutput(sh`echo three`)
  await logOutput(sh`echo four`.echo(true))
})

export const text = task(async ({ sh }) => {
  const output = await sh`echo hidden`.text()
  console.log(`got ${output.trim()}`)
})

export const escaping = task(async ({ sh }) => {
  await logOutput(sh`echo ${["a b.txt", "c.txt"]}`)
  await logOutput(sh`echo ${"it's here"}`)
  await logOutput(sh`echo ${{ raw: "one   two" }}`)
})

export const cwd = task(async ({ sh }) => {
  sh.echo(false)
  sh.cwd(path.join(import.meta.dir, "sub"))
  await logOutput(sh`pwd`)
  sh.cwd(path.join(import.meta.dir, "sub/inner"))
  await logOutput(sh`pwd`)
  await logOutput(sh`pwd`.cwd(import.meta.dir))
})

export const env = task(async ({ sh }) => {
  sh.echo(false)
  sh.env({ GREETING: "hi" })
  await logOutput(sh`echo greeting=$GREETING home=$HOME`)
  await logOutput(sh`echo greeting=$GREETING`.env({ GREETING: "hello" }))
  await logOutput(sh`echo greeting=$GREETING home=$HOME`.env({ HOME: undefined }))
})

const configure = task(({ sh }) => {
  sh.cwd("/").env({ GREETING: "from another task" }).echo(false)
})

export const isolated = task(async ({ sh }) => {
  await configure()
  await logOutput(sh`echo greeting=$GREETING`)
  await logOutput(sh`pwd`)
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
  await logOutput(sh`echo greeting=$GREETING`)
  await logOutput(sh`pwd`)
})

process.env["LOADED"] = "at load"

export const processEnv = task(async ({ sh }) => {
  process.env["GREETING"] = "set later"
  await logOutput(sh`echo greeting=$GREETING loaded=$LOADED`.echo(false))
  await logOutput(sh`echo greeting=$GREETING`.env(process.env).echo(false))
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
  await sh`echo done`.quiet().finally(() => {
    console.log("finally")
  })
})

export const bunToggle = task(async ({ sh }) => {
  sh.echo(false)
  await logOutput(sh`runtime`)
  await logOutput(sh`runtime`.bun(false))
  sh.bun(false)
  await logOutput(sh`runtime`)
  await logOutput(sh`runtime`.bun(true))
})

export const bunEnv = task(async ({ sh }) => {
  await logOutput(sh`runtime`.env({ GREETING: "hi" }).echo(false))
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
  const command = sh`echo once`.quiet()
  await command
  const output = await command
  console.log(output.text().trim())
})

export const noPath = task(async ({ sh }) => {
  sh.echo(false).env({ PATH: undefined })
  await logOutput(sh`echo path=$PATH`)
  await logOutput(sh`echo path=$PATH`.bun(false))
})
