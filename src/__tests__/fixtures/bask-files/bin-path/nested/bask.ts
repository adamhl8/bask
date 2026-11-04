import { task } from "@adamhl8/bask"

export const bins = task(async ({ sh }) => {
  await sh`inner`
  await sh`outer`
  await sh`both`
})
