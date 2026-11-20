<h1 align="center"><img align="top" style="color:#36BCF7; width:38px; height:38px;" src="https://raw.githubusercontent.com/adamhl8/bask/refs/heads/main/assets/logo.svg"> bask</h1>

A task runner where your tasks are TypeScript functions.

---

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Tasks](#tasks)
  - [Defining tasks](#defining-tasks)
  - [Task options](#task-options)
  - [Task naming](#task-naming)
  - [The default task](#the-default-task)
  - [Task arguments](#task-arguments)
  - [Task dependencies](#task-dependencies)
  - [Task hooks](#task-hooks)
  - [Wrapping tasks](#wrapping-tasks)
- [Running commands](#running-commands)
  - [Shell settings](#shell-settings)
- [Extending/sharing tasks](#extendingsharing-tasks)
- [CLI Reference](#cli-reference)

<!-- tocstop -->

## Installation

bask requires [Bun](https://bun.sh) to be installed. Commands run in `/bin/sh`, so bask works on macOS and Linux.

- Your project does _not_ need to be Bun-based. You can use bask with any runtime (Node) or package manager (npm, yarn, pnpm, etc.).

```sh
bun add --dev @adamhl8/bask
```

> [!TIP]
> To run tasks with a plain `bask` instead of `bunx bask`, also install it globally:
>
> ```sh
> bun add --global @adamhl8/bask
> ```
>
> The global `bask` hands off to the project's copy when there is one, so each project will use its installed version of bask.

## Usage

Create a `bask.ts` in your project root and export some tasks:

```ts
import { task } from "@adamhl8/bask"

export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task({ desc: "Lint, then build" }, async ({ sh }) => {
  await lint() // calling a task makes it a dependency
  await sh`tsdown`
})

export const bumpDeps = task(async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})

export default build
```

Run a task by its export name:

```sh
bask build
bask bump-deps # runs `bumpDeps`
```

> [!TIP]
> In scripts or CI, use `bunx bask` so you don't have to install bask globally.

Run `bask` with no task name to run the default export (`build` above).

```sh
bask # runs `build`
```

Run `bask --list` to list available tasks:

```
Available tasks:
    build     # Lint, then build [default]
    bump-deps
    lint
```

## Tasks

### Defining tasks

`task` takes a function, and optionally an [options](#task-options) object first. The function receives `sh`, a [shell](#running-commands) for running commands, along with the task's [`args` and `positionals`](#task-arguments). It can be async or sync:

```ts
export const build = task({ desc: "Build the project" }, async ({ sh }) => {
  await sh`tsdown`
})

export const hello = task(() => {
  console.log("hello")
})
```

---

### Task options

- `desc`: Shown next to the task in the task list
- `hidden`: Keeps the task runnable but leaves it out of the task list
- `alias`: Other names the task runs under, as a string or an array
  - Write them in kebab-case or camelCase, and either spelling runs the task
- `args`: The args the task takes from the command line (see [Task arguments](#task-arguments))
- `positionals`: Lets the task take positionals, including everything after `--` (see [Task arguments](#task-arguments))

```ts
export const releaseRun = task({ desc: "Run from CI", hidden: true }, async ({ sh }) => {
  await sh`release-it --ci`
})

export const bumpDeps = task({ alias: ["up", "update-deps"] }, async ({ sh }) => {
  await sh`bunx npm-check-updates --upgrade`
})
```

Aliases show next to the task in the task list:

```
    bump-deps # [aliases: up, update-deps]
```

---

### Task naming

A task exported with a camelCase name can be run by using its equivalent kebab-case name.

```ts
export const bumpDeps = task(async ({ sh }) => {
  // ...
})
```

These will both run `bumpDeps`:

```sh
bask bumpDeps
bask bump-deps
```

---

### The default task

Running `bask` on its own runs the default export. If `bask.ts` has no default export, it lists your tasks instead (the same as `bask --list`).

```ts
import { task } from "@adamhl8/bask"

export const build = task(async ({ sh }) => {
  await sh`tsdown`
})

export default build
```

---

### Task arguments

A task can take args from the command line. Declare them with the `args` option, and set `positionals: true` to accept positionals. The task gets them, typed, as `args` and `positionals`:

```ts
export const test = task(
  {
    desc: "Run tests",
    args: {
      watch: { short: "w", desc: "Rerun when files change" },
      timeout: { type: "string", desc: "Per-test timeout in ms" },
    },
    positionals: true,
  },
  async ({ sh, args, positionals }) => {
    // args: { watch: boolean, timeout: string | undefined }, positionals: string[]
    await sh`bun test ${args.watch ? "--watch" : []} --timeout ${args.timeout ?? "5000"} ${positionals}`
  },
)
```

```sh
bask test -w --timeout 10000 src/foo.test.ts
bask test -- --bail # everything after `--` is a positional
```

Each arg takes:

- `short`: A one-letter or one-digit short flag, like `w` for `-w`
- `type`: `"boolean"` (the default) or `"string"`
- `desc`: Shown on the task's help page

The long flag is the arg's name in kebab-case, so `dryRun` is `--dry-run`. An arg that isn't passed is `false` if it's a boolean, or `undefined` if it's a string.

- Flags before the task name are bask's, and args after it are the task's: `bask -l` lists the tasks, while `bask test -l` passes `-l` to `test`
  - bask doesn't reserve any names, so a task can declare its own `-l` or `-h`
- You must name a default task to pass args to it: `bask build -w` or `bask default -w`
- An unknown flag, a missing value, or a positional to a task that doesn't accept them prints the task's usage and an error, and exits with code 2

Only the command line passes args, and only to the task you named. A task that runs as a [dependency](#task-dependencies) or as a [hook](#task-hooks) gets its own empty args, so for a variant, make a separate task. A hook function on the named task gets that task's `args` and `positionals` (see [Task hooks](#task-hooks)).

Run `bask -h <task>` to see a task's help page:

```
Run tests
Usage: bask test [-w/--watch] [--timeout VALUE] [ARG...]

  ARG
  -w, --watch                 Rerun when files change
  --timeout VALUE             Per-test timeout in ms
```

Args also show next to the task in the task list:

```
    test # Run tests [-w/--watch] [--timeout VALUE] [ARG...]
```

---

### Task dependencies

To depend on another task, call it. Each task runs at most once per invocation, however many tasks call it. If two tasks call it at the same time, they both wait on the same run. A task that calls itself, directly or through other tasks, will throw an error.

```ts
export const check = task(async () => {
  await Promise.all([lint(), build()])
})

export const ci = task(async () => {
  await check()
  await lint() // already ran, so this does nothing
})
```

---

### Task hooks

> [!IMPORTANT]
> You'll generally only need hooks when [extending tasks](#extendingsharing-tasks) from another bask file. For tasks in your own `bask.ts`, it's simpler to call them directly from the task.

On tasks, use `before` and `after` to add hooks:

```ts
export const clean = task(async ({ sh }) => {
  await sh`rm -rf dist`
})

export const build = task(async ({ sh }) => {
  await sh`tsdown`
})

build.before(clean)
build.after(async ({ sh }) => {
  await sh`du -sh dist`
})
```

- Hooks take tasks or plain functions
- Hooks run in the order they were added (see [Wrapping tasks](#wrapping-tasks) for how they combine with wraps)
- Hooks run once per invocation, along with their task
  - This includes when another task calls the task
- Each hook gets its own `sh`, separate from the task's
- A hook function gets its task's `args` and `positionals`, typed from the task's `args` option
- A task used as a hook runs with its own empty args, not the args of the task it's hooked to
- Adding a hook to a task that has already started throws an error

A hook function can check its task's args, which helps when extending a shared task:

```ts
// The shared `build` task declares a `watch` arg
build.after(async ({ sh, args }) => {
  if (!args.watch) await sh`du -sh dist`
})
```

The built-in `list` task, which prints the task list, takes hooks too:

```ts
import { list } from "@adamhl8/bask"

list.after(() => {
  console.log("\nRun `bask <task>` to run a task.")
})
```

---

### Wrapping tasks

> [!IMPORTANT]
> Like hooks, you'll generally only need `wrap` when [extending tasks](#extendingsharing-tasks) from another bask file.

Use `wrap` to change what a task does, or to add args to it. The function you pass wraps the task as it stands, including the hooks added so far, and `original()` runs what it wrapped:

```ts
import { build } from "./shared-tasks.ts"

export * from "./shared-tasks.ts"

// Add the `-r` flag which the original build task doesn't have.
build.wrap({ args: { release: { short: "r", desc: "Build for release" } } }, async ({ sh, args, original }) => {
  await original()
  if (args.release) await sh`bun run sign`
})
```

```sh
bask build -r
```

- `wrap` changes the task in place, so everything that calls it, including other shared tasks, runs the wrapped version
- The wrap function gets `sh`, `args`, and `positionals`, like the task, plus `original`
- Call `original()` to run the wrapped task, or leave it out if you want to replace the task entirely
  - `original()` runs the entire task as it was when it was wrapped, before and after hooks included
  - `original` runs with the same `args` and `positionals`, and is given a fresh instance of `sh`
  - Call `original()`, never the task itself, because a task that calls itself throws an error
- `args` are added to the task's args, as if the task had declared them
  - They're parsed from the command line, and they show in `bask -h <task>` and the task list
  - An arg name the task already has throws an error
- Hooks added before the wrap run inside it, as part of `original()`
- Hooks added after the wrap run around it
- Wrapping a task that has already started throws an error

For example:

```ts
build.before(clean) // clean, build
build.before(lint) // clean, lint, build
build.wrap(async ({ original }) => {
  console.log("start")
  await original()
}) // start, clean, lint, build
build.before(check) // check, start, clean, lint, build
```

## Running commands

Every task gets a shell, `sh`, which runs each command in `/bin/sh` and prints it before running it:

```ts
export const lint = task(async ({ sh }) => {
  await sh`oxlint --fix`
  // prints "oxlint --fix", then runs it
})
```

> [!TIP]
> Like a `package.json` script, `sh` finds installed bins in `node_modules/.bin`, so `oxlint` and `bun oxlint` both work.
>
> By default, `sh` runs `node_modules` bins and other `node` commands under Bun, like Bun's `--bun` flag. To use the real Node, see `.bun()` in [Shell settings](#shell-settings).

A command gets your terminal, like it would in a `package.json` script or a justfile. Interactive tools can prompt, and tools that check for a terminal show their colors and progress, so bask never sets `FORCE_COLOR`.

Interpolated values are quoted for the shell, so a space, quote, or `$` in them stays literal:

- An array becomes one word per item: ``sh`rm ${files}` ``
- `{ raw: "..." }` goes in unquoted, for text you want the shell to parse

To read a command's output, use one of the readers below. A reader takes stdout instead of showing it, but stderr still goes to the terminal, so warnings and prompts still show:

- `.text()` - stdout as a string
- `.json()` - stdout parsed as JSON
- `.lines()` - stdout one line at a time, as the command prints it
- `.arrayBuffer()` and `.blob()` - stdout as bytes

```ts
export const release = task(async ({ sh }) => {
  const branch = await sh`git branch --show-current`.echo(false).text()
  if (branch.trim() === "main") await sh`gh workflow run release.yml`
})
```

Awaiting a command gives `{ exitCode, stdout, stderr }`. `stdout` and `stderr` hold only what bask read instead of showing, so they're empty unless the command is quiet. A command that fails throws a `CommandError` with the same three fields, unless it's set to `.nothrow()`.

### Shell settings

The following methods can be used on the `sh` instance _or_ on each command. To set them for every shell, see [Project-wide shell settings](#project-wide-shell-settings).

- `.cwd()` - Changes the working directory
  - Relative paths resolve from the directory you ran `bask` in, not from the `sh` instance's cwd
- `.env()` - Adds environment variables on top of `process.env`: `.env({ DEBUG: "1" })`
  - Set a variable to `undefined` to remove it: `.env({ DEBUG: undefined })`
  - Commands use `process.env` as it was when `bask.ts` finished loading, so later changes to it don't reach them
  - Pass later changes through with `.env(process.env)`. This also brings back variables removed earlier, so put removals after it: `.env({ ...process.env, DEBUG: undefined })`
- `.quiet()` - Reads the command's stdout and stderr instead of writing them to the terminal
  - If a quiet command fails and the error isn't caught, bask prints its output along with the error
- `.nothrow()` - Doesn't throw an error when a command exits with a non-zero exit code
- `.throws()` - Sets whether a non-zero exit code throws an error
- `.echo()` - Sets whether the command is printed before it runs
- `.bun()` - Sets whether `node_modules` bins and other `node` commands run under Bun (on by default)
  - Turn it off for a tool that doesn't work on Bun: ``sh`some-tool`.bun(false)``

Each task gets its own fresh instance of `sh`, so changes to `sh` do not affect other tasks' `sh`. Using the above methods on `sh` will apply to every command after the call in the task.

```ts
export const buildWeb = task(async ({ sh }) => {
  sh.cwd("packages/web")
  await sh`bun install`
  await sh`bun run build`
  // Override `cwd` for just this command
  await sh`cp -r packages/web/dist packages/server/public`.cwd(".")
})
```

#### Project-wide shell settings

To change the defaults for every shell, including the ones in task hooks, export `baskConfig` from `bask.ts`:

```ts
import { defineConfig } from "@adamhl8/bask"

export const baskConfig = defineConfig({
  shell: { echo: false, bun: false },
})
```

`shell` takes `cwd`, `env`, `quiet`, `throws`, `echo`, and `bun`, which work like the methods above. A setting on `sh` overrides `baskConfig`, and a setting on a command overrides both.

- `env` adds to `process.env` as it was when `bask.ts` finished loading, and the `env` of `sh` and of each command add to that
- `sh.cwd()` and `sh.env()` with no argument go back to the `baskConfig` value
- A `baskConfig` re-exported with `export *` applies, but a `baskConfig` in `bask.ts` replaces it entirely

## Extending/sharing tasks

Tasks don't have to live in `bask.ts`. They can live in any other file or package, so many projects can use the same tasks.

```ts
// shared-tasks.ts
import { task } from "@adamhl8/bask"

export const lint = task(async ({ sh }) => {
  await sh`oxlint`
})

export const build = task(async ({ sh }) => {
  await lint()
  await sh`tsdown`
})
```

To make them runnable, re-export them from your `bask.ts`:

```ts
// bask.ts
import { task } from "@adamhl8/bask"

export * from "./shared-tasks.ts"

export const deploy = task(async ({ sh }) => {
  // ...
})
```

The `lint`, `build`, and `deploy` tasks will all be available.

> [!IMPORTANT]
> `export * from` never re-exports a default. If a shared tasks module has a default export, re-export it by name for it to apply:
>
> ```ts
> export * from "./shared-tasks.ts"
> export { default } from "./shared-tasks.ts"
> ```

If a project needs to do something before or after a shared task, use [hooks](#task-hooks). A hook you add to an imported task also runs when the shared tasks call it. For example:

```ts
// bask.ts
import { task } from "@adamhl8/bask"

import { build, lint } from "./shared-tasks.ts"

export * from "./shared-tasks.ts"

export const astroSync = task(async ({ sh }) => {
  await sh`astro sync`
})

export const astroBuild = task(async ({ sh }) => {
  await sh`astro build`
})

lint.before(astroSync)
build.after(astroBuild)
```

```sh
bask build
# runs astroSync -> lint -> build -> astroBuild
```

This way, each project extends the shared tasks without copying or replacing them. To change what a shared task does, or to add args to it, [wrap](#wrapping-tasks) it.

## CLI Reference

`bask [-l] [-h] [--version] [task] [task args]`

- `task`: The task to run, by its kebab-case name, camelCase name, or an alias (default: the default export)
- `task args`: The [args and positionals](#task-arguments) to pass to the task
- `-l`, `--list`: List the available tasks
- `-h`, `--help`: Show bask's help and the task list, or a task's help with `bask -h <task>`
- `--version`: Show bask's version

If the arguments are invalid, including an unknown task, bask prints the usage and an error.

**Exit codes:**

- `0`: The task succeeded
- `1`: There's no `bask.ts`, or it has a problem (e.g. a task exported twice)
- `2`: The arguments are invalid, including an unknown task or the task's args
- A task can set `process.exitCode` to make bask exit with that code without reporting an error. The code belongs to the
  process, so a task that another task calls can set it too.
- Otherwise, the exit code of the command that failed, which replaces any code a task set
