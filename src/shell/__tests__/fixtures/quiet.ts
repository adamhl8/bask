import { defineConfig } from "#config.ts"
import { task } from "#task.ts"

export const baskConfig = defineConfig({ shell: { quiet: true, echo: false } })

const failingScript = "echo out; echo err >&2; exit 3"

export const failure = task(async ({ sh }) => {
  await sh`sh -c ${failingScript}`
})

export const textFailure = task(async ({ sh }) => {
  await sh`sh -c ${failingScript}`.text()
})

export const shellQuietFailure = task(async ({ sh }) => {
  sh.quiet(false)
  sh.quiet()
  await sh`sh -c ${failingScript}`
})

export const caught = task(async ({ sh }) => {
  await sh`sh -c ${failingScript}`.catch(() => {
    console.log("caught")
  })
})

export const linesFailure = task(async ({ sh }) => {
  for await (const line of sh`sh -c ${failingScript}`.lines()) console.log(line)
})

export const missingCwd = task(async ({ sh }) => {
  await sh`echo hidden`.cwd("missing")
})
