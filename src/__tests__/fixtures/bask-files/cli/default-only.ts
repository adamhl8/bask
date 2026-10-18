import { task } from "@adamhl8/bask"

export const lint = task(() => {
  console.log("ran lint")
})

const deploy = task(() => {
  console.log("ran deploy")
})

export default deploy
