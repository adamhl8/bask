import { task } from "#task.ts"

export const build = task(() => {
  console.log("ran build")
})

const deploy = () => {
  console.log("ran deploy")
}

export default deploy
