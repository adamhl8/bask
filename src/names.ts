/** Converts a kebab-case task name to the camelCase export name, so `bump-deps` finds `bumpDeps`. */
export const toExportName = (taskName: string) =>
  taskName.replaceAll(/-[a-z\d]/gv, (match) => match.slice(1).toUpperCase())

/** Converts a camelCase export name to the kebab-case task name, so `bumpDeps` lists as `bump-deps`. */
export const toTaskName = (exportName: string) => exportName.replaceAll(/[A-Z]/gv, (match) => `-${match.toLowerCase()}`)
