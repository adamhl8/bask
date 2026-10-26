import { defineConfig, task } from "@adamhl8/bask"

export const baskConfig = defineConfig({
  shell: { cwd: "sub", env: { GREETING: "from config" }, echo: false, throws: false, bun: false },
})

export const defaults = task(async ({ sh }) => {
  await sh`pwd`
  await sh`echo greeting=$GREETING`
  await sh`runtime`
  await sh`exit 3`
  console.log("kept going")
})

defaults.before(async ({ sh }) => {
  await sh`echo hook greeting=$GREETING`
})

export const overrides = task(async ({ sh }) => {
  sh.echo(true).env({ GREETING: "from sh" })
  await sh`echo greeting=$GREETING`
  await sh`echo greeting=$GREETING`.env({ GREETING: "from command" }).echo(false)
  await sh`pwd`.cwd(".")
  await sh`runtime`.bun(true)
  await sh`exit 3`.throws(true)
})

export const reset = task(async ({ sh }) => {
  sh.cwd("/").env({ GREETING: "changed" })
  sh.cwd().env()
  await sh`pwd`
  await sh`echo greeting=$GREETING`
})

// Set these after `defineConfig` because bask copies `process.env` once `bask.ts` has loaded, not when the config is defined.
process.env["FROM_PROCESS"] = "process"
process.env["GREETING"] = "from process"

export const layers = task(async ({ sh }) => {
  process.env["FROM_LATER"] = "later"
  sh.env({ FROM_SH: "sh" })
  await sh`echo $GREETING $FROM_SH $FROM_PROCESS $FROM_COMMAND $FROM_LATER`.env({ FROM_COMMAND: "command" })
})
