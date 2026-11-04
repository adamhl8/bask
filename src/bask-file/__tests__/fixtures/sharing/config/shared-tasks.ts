import { defineConfig } from "#config.ts"
import { task } from "#task.ts"

export const baskConfig = defineConfig({ shell: { echo: false } })

export const hello = task(async ({ sh }) => {
  const output = await sh`echo hi`.text()
  console.log(output.trim())
})
