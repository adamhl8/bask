import { err } from "ts-explicit-errors"

import type { BaskFile } from "#bask-file/bask-file.ts"

let loadedBaskFile: BaskFile | undefined

/** Stores the validated `bask.ts` for tasks to read when they run. */
export const setLoadedBaskFile = (baskFile: BaskFile) => {
  loadedBaskFile = baskFile
}

/**
 * Returns the loaded `bask.ts`. Throws until the CLI has loaded it, because only a task called at the top level of
 * `bask.ts` gets here that early.
 */
export const getLoadedBaskFile = () => {
  if (loadedBaskFile) return loadedBaskFile
  throw err(
    "a task ran while bask.ts was loading. Call tasks from inside other tasks, not at the top level.",
    undefined,
    { invalidBaskFile: true },
  )
}
