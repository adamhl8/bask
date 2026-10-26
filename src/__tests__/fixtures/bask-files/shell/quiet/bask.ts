import { defineConfig, task } from "@adamhl8/bask"

export const baskConfig = defineConfig({ shell: { quiet: true, echo: false } })

const failingScript = "echo out; echo err >&2; exit 3"

export const levels = task(async ({ sh }) => {
  await sh`echo hidden by config`
  sh.quiet(false)
  await sh`echo shown by sh`
  await sh`echo hidden by command`.quiet()
})

export const failure = task(async ({ sh }) => {
  await sh`sh -c ${failingScript}`
})

export const textFailure = task(async ({ sh }) => {
  await sh`sh -c ${failingScript}`.text()
})

export const shownFailure = task(async ({ sh }) => {
  sh.quiet(false)
  await sh`sh -c ${failingScript}`
})

export const caught = task(async ({ sh }) => {
  await sh`sh -c ${failingScript}`.catch(() => {
    console.log("caught")
  })
})
