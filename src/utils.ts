export const toKebabCase = (name: string) => name.replaceAll(/[A-Z]/gv, (match) => `-${match.toLowerCase()}`)
export const toCamelCase = (name: string) => name.replaceAll(/-[\da-z]/gv, (match) => match.slice(1).toUpperCase())
