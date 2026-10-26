import { defineConfig, task } from "@adamhl8/bask"

export const baskConfig = defineConfig({ shell: { echo: false } })

export const hello = task(async ({ sh }) => {
  await sh`echo hi`
})
