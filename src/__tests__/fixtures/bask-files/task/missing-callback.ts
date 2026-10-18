import { task } from "@adamhl8/bask"

// @ts-expect-error - a missing callback is the mistake under test
export const build = task({ desc: "Build the project" })
