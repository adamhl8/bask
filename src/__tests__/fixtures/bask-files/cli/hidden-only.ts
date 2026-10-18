import { task } from "@adamhl8/bask"

export const releaseRun = task({ hidden: true }, () => {
  console.log("ran release-run")
})
