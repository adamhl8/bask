# bask

A task runner for Bun where tasks are TypeScript functions.

## Requirements

- [Bun](https://bun.sh), because tasks run on Bun and shell out with Bun's `$`

## Install

```sh
bun add --dev @adamhl8/bask
```

To run tasks with a plain `bask` instead of `bunx bask`, also install it globally:

```sh
bun add --global @adamhl8/bask
```

The global `bask` hands off to the project's copy when there is one, so each project still runs the version it pins.

## Usage

Export tasks from a `bask.ts` in your project root. Calling a task from another task makes it a dependency, and each task runs at most once per invocation.

```ts
import { task } from "@adamhl8/bask"

export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task({ desc: "Lint, then build" }, async ({ sh }) => {
  await lint()
  await sh`tsdown`
})

export const bumpDeps = task(async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})

export default build
```

Run a task with `bask` if you installed it globally, or with `bunx bask` otherwise. Use `bunx` rather than `bun`, because `bun bask` runs your `bask.ts` instead of the `bask` bin. Task names are the export names in kebab-case, so `bump-deps` runs `bumpDeps`.

```sh
bask build
bask bump-deps
```

Scripts and CI should use `bunx bask`, because they can't count on a global install.

### The default task and the task list

`bask` with no task name runs the default export. If `bask.ts` has no default export, it lists your tasks instead, the same as `bask --list` (or `-l`):

```
Available tasks:
    build     # Lint, then build [default]
    bump-deps
    lint
```

`export * from` never re-exports a default, so a default from a shared tasks module only applies if you re-export it by name.

### Task options

- `desc`: shown next to the task in the list.
- `hidden`: keeps the task runnable but leaves it out of the list.
- `alias`: other names the task runs under, as a string or an array. Write them in kebab-case or camelCase, and either spelling runs the task.

```ts
export const releaseRun = task({ desc: "Run from CI", hidden: true }, async ({ sh }) => {
  await sh`bun release-it --ci`
})

export const bumpDeps = task({ alias: ["up", "update-deps"] }, async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})
```

Aliases show next to the task in the list:

```
    bump-deps # [aliases: up, update-deps]
```

Use `alias` rather than exporting the same task under a second name. bask can't tell which export is the original, so exporting a task twice is an error. `export default` is the exception.

### Running commands

`sh` prints each command before running it with Bun's `$`. To run a command without printing it, use Bun's `$` directly.

```ts
import { $ } from "bun"

export const release = task(async ({ sh }) => {
  const branch = await $`git branch --show-current`.text()
  if (branch.trim() === "main") await sh`gh workflow run release.yml`
})
```

When a command fails, bask stops and names the task it failed in, then exits with the command's exit code:

```
error: task 'lint' failed with exit code 2
```

Any other error thrown in a task still shows its stack trace.

### Extending tasks

`before` and `after` add hooks that run around a task. A hook added in your `bask.ts` also runs when another task calls that task, including tasks you imported. This lets a project extend shared tasks without replacing them.

```ts
import { task } from "@adamhl8/bask"

import { build, lint } from "./shared-tasks.ts"

export * from "./shared-tasks.ts"

export const astroSync = task(async ({ sh }) => {
  await sh`bun astro sync`
})

lint.before(astroSync)
build.after(async ({ sh }) => {
  await sh`bun astro build`
})
```

Hooks take tasks or plain functions, run in the order they were added, and run once per invocation along with their task. Adding a hook to a task that has already started throws.

The built-in `list` task, which prints the task list, takes hooks too:

```ts
import { list } from "@adamhl8/bask"

list.after(() => {
  console.log("\nRun `bask <task>` to run a task.")
})
```
