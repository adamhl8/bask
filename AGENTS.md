# AGENTS.md

## Lint

- `bask lint` runs `oxlint --fix --fix-dangerously`, which rewrites code as it fixes:
  - `null` becomes `undefined` (`unicorn/no-null`)
  - `() => undefined` becomes `() => {}`
  - an `async` function that never awaits loses its `async`
- So a test fixture that needs a visible "absent" value in JSON can't use `null`. Write a marker string such as
  `"undefined"` instead.

## Public types

- Export from `src/index.ts` every type that can show up in the inferred type of a user's task, such as `NoArgs` in
  `Task<NoArgs>`. Otherwise a `bask.ts` that emits declarations fails with TS2883 ("cannot be named without a
  reference to ..."). The subprocess test "should let a bask.ts emit declarations for a task that takes no args"
  checks this against the packed package.

## Global and local copies

- A global bask hands off to the project's copy by importing its CLI in the same process, so the project's copy sets
  the exit code itself.
- `isTask` only recognizes tasks made by its own copy, so `bask.ts` must import the copy that's running. With no local
  copy, `provideRunningCopy` in `src/cli/local-cli.ts` serves the running copy's exports as a virtual
  `@adamhl8/bask` module.
- That uses `build.module`, because a runtime `Bun.plugin`'s `onResolve` never fires for a bare package name.
- Bun auto-installs imports in a folder with no `node_modules` up the tree, which is why `findLocalCli` checks for one.
  Tests that cover this point Bun at an empty cache and a local stand-in registry (`runWithStandInRegistry`), so they
  never reach npm.

## Optique

bask parses command-line args with `@optique/core`, but the task API never exposes it.

- Wrap plain strings in `text()` inside `message` templates (`message`${text(desc)}``). A bare `${desc}` renders as a
  quoted value.
- `choice()` throws on an empty list, and a `bask.ts` with no tasks has one. Task names are checked by a small lookup
  value parser in `src/cli/bask-parser.ts` instead.
- `runParser()`'s sync overload types its result as the parsed value even when `onError` returns something else.
  `parseWithOptique` in `src/cli/optique.ts` writes out `T | undefined` for that reason.
- One Optique parser can't hold both bask's flags and a task's flags. Optique matches flags by name, so a shared name
  like `-l` throws, and `seq()` treats a `--` right after the task name as the end of the task's args. That's why
  `splitArgs` splits by position and each half gets its own parser.
- `-h` and `--version` are plain flags in `toBaskParser`, not Optique's runner options. bask's help page comes from
  `getDocPage(baskParser)`, which leaves out the options the runner adds.

## Shell

- `sh` runs each command as `/bin/sh -c <command>` with `Bun.spawn`, not Bun's `$`. Bun's `$` always pipes stdout and
  stderr, so a command never sees the terminal, and it can't redirect to the terminal either.
- A command inherits stdin, stdout, and stderr, like just and `npm run`. bask pipes only what it reads: stdout for a
  reader like `.text()`, and stdout and stderr when the command is quiet. A failed command's `CommandError` holds only
  the piped streams, and `runTask` prints them, because the terminal never showed them.
- Interpolated strings are quoted with Bun's `$.escape`, even though Bun's shell no longer runs them. Its quoting works
  in POSIX `sh` too. The test "should pass an interpolated value to the shell unchanged" sends a value full of shell
  syntax through `/bin/sh`, so it fails if a Bun release changes that.
- bask never sets `FORCE_COLOR` or any other color variable for a command. It used to, to make up for Bun's pipes, and
  it leaked into every process the command started, including `bun test`.

## Tests

- `minimalEnv()` passes only `PATH` and `HOME`, so a test that runs bask in a terminal (`runInTerminal`) gets no color
  from `styleText` unless it also sets `TERM` (e.g. `xterm-256color`).
- Optique's colors come from the same `styleText` check as bask's own `error:` line (`toOptiqueOutput` in
  `src/cli/optique.ts`), so both follow `NO_COLOR`, `FORCE_COLOR`, and `TERM` the same way.
- In-process tests can't rely on `runInProcess`'s minimal env to control color, because `styleText` reads the real
  environment. A `FORCE_COLOR` in the shell that runs the tests turns color on, and Optique then marks values with color
  instead of quotes, so the assertions on quoted values fail.
- `pwd` and `$PATH` come from `/bin/sh` itself. `sh` prints a logical `pwd` from an inherited `PWD` that names the same
  folder by another path, which is why a command with a `cwd` gets `PWD` set to it. `sh` also fills in its own `$PATH`
  when `PATH` is unset, so check for an unset `PATH` with `/usr/bin/printenv`.
