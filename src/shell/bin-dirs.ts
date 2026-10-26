import path from "node:path"

/** Lists `node_modules/.bin` for `dir` and each of its parents, nearest first. */
const getBinDirs = (dir: string): string[] => {
  const binDir = path.join(dir, "node_modules", ".bin")
  const parent = path.dirname(dir)
  return parent === dir ? [binDir] : [binDir, ...getBinDirs(parent)]
}

/** Prepends the project's `.bin` folders to the process `PATH`, like `bun run`, so anything a task starts finds them. */
export const addBinDirsToPath = (projectDir: string) => {
  process.env["PATH"] = [...getBinDirs(projectDir), process.env["PATH"]].filter(Boolean).join(path.delimiter)
}
