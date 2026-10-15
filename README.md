# bask

A task runner for Bun where tasks are TypeScript functions.

## Requirements

- [Bun](https://bun.sh), because tasks run on Bun and shell out with Bun's `$`

## Install

```sh
bun add --dev @adamhl8/bask
```

## Usage

Export tasks from a `bask.ts` in your project root. The default export is the task that runs when you don't name one. Calling a task from another task makes it a dependency, and each task runs at most once per invocation.

```ts
import { task } from "@adamhl8/bask"

export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task({ desc: "Lint, then build" }, async ({ sh }) => {
  await lint()
  await sh`tsdown`
})

export default build
```

`sh` prints each command before running it with Bun's `$`. To run a command without printing it, use Bun's `$` directly (`import { $ } from "bun"`).

Run a task with `bunx`, because `bun bask` runs your `bask.ts` instead of the `bask` bin.

```sh
bunx bask build
```
