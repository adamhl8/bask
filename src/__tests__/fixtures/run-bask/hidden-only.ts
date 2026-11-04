import { task } from "#task.ts"

export const releaseRun = task({ hidden: true }, () => {
  console.log("ran release-run")
})
