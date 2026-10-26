import type { BaskFile } from "#bask-file/bask-file.ts"

let loadedBaskFile: BaskFile | undefined

/** Stores the validated `bask.ts` for tasks to read when they run. */
export const setLoadedBaskFile = (baskFile: BaskFile) => {
  loadedBaskFile = baskFile
}

/** Returns the loaded `bask.ts`, or `undefined` until the CLI has loaded it. */
export const getLoadedBaskFile = () => loadedBaskFile
