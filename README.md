# @mysticatea/fs-watcher

[![npm version](https://img.shields.io/npm/v/@mysticatea/fs-watcher.svg)](https://www.npmjs.com/package/@mysticatea/fs-watcher)
[![Downloads/month](https://img.shields.io/npm/dm/@mysticatea/fs-watcher.svg)](http://www.npmtrends.com/@mysticatea/fs-watcher)
[![Build Status](https://travis-ci.org/mysticatea/fs-watcher.svg?branch=master)](https://travis-ci.org/mysticatea/fs-watcher)
[![Dependency Status](https://david-dm.org/mysticatea/fs-watcher.svg)](https://david-dm.org/mysticatea/fs-watcher)

Yet another file system watchers.

## 🏁 Motivation

This is file system watchers with no depending [fsevents](https://www.npmjs.com/package/fsevents) package.

## 💿 Installation

```bash
$ npm install @mysticatea/fs-watcher
```

- Requires Node.js 6.5.0 or later.

## 📖 Usage

Import this package with `import` or `require()`.

```js
import { watchDir, watchFiles } from "@mysticatea/fs-watcher"
// OR
const { watchDir, watchFiles } = require("@mysticatea/fs-watcher")
```

If you are using TypeScript, there are some types.

```ts
import {
    FileEvent,
    Watcher,
    watchDir,
    watchFiles
} from "@mysticatea/fs-watcher"
```

### watchDir(dirPath, options?)

Watch file changes in a given directory. This is not recursive.

**Parameters:**

|  | Type | Description
|:-|:-----|:------------
| `dirPath` | `string` | The path to a directory to watch.
| `options` | `object` | Options.
| `options.pollingInterval` | `number` or `undefined` | The polling interval. Default is `undefined`. If this is `undefined`, the watcher is using efficient [`fs.watch()`](https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener) API. Otherwise, the watcher is using legacy [`fs.watchFile()`](https://nodejs.org/api/fs.html#fs_fs_watchfile_filename_options_listener) API.

**Return value:**

|  | Type | Description
|:-|:-----|:------------
|  | `Promise<DirectoryWatcher>` | A `DirectoryWatcher` object to listen events. The `DirectoryWatcher` inherits [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) class. Use `.close()` method if you want to stop watching.

**Events:**

|  | Listener Type | Description
|:-|:--------------|:------------
| `add` | `(event: FileEvent) => void` | This is notified when a file was added into the directory.
| `remove` | `(event: FileEvent) => void` | This is notified when a file was removed from the directory.
| `change` | `(event: FileEvent) => void` | This is notified when a file in the directory was changed.
| `error` | `(error: Error) => void` | This is notified when an error happens while watching.

**Example:**

```js
import { watchDir } from "@mysticatea/fs-watcher"

;(async () => {
    // Start watching.
    const watcher = await watchDir("path/to/a_directory")

    // Listen events.
    watcher.on("add", event => {
        console.log("added:", event.path, event.stat)
    })
    watcher.on("remove", event => {
        console.log("removed:", event.path, event.stat)
    })
    watcher.on("change", event => {
        console.log("changed:", event.path, event.stat)
    })
    watcher.on("error", error => {
        console.error("error:", error)
    })

    // Stop watching.
    await watcher.close()
})()
```

### watchFiles(globs, options?)

Watch the changes of given files by glob patterns.

**Parameters:**

|  | Type | Description
|:-|:-----|:------------
| `globs` | `string` or `string[]` | The glob patterns to watch. If a pattern starts with `!` then it excludes the pattern from the target files.
| `options` | `object` | Options.
| `options.pollingInterval` | `number` or `undefined` | The polling interval. Default is `undefined`. If this is `undefined`, the watcher is using efficient [`fs.watch()`](https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener) API. Otherwise, the watcher is using legacy [`fs.watchFile()`](https://nodejs.org/api/fs.html#fs_fs_watchfile_filename_options_listener) API.

**Return value:**

|  | Type | Description
|:-|:-----|:------------
|  | `Promise<GlobWatcher>` | A `GlobWatcher` object to listen events. The `GlobWatcher` inherits [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) class. Use `.close()` method if you want to stop watching.

**Events:**

|  | Listener Type | Description
|:-|:--------------|:------------
| `add` | `(event: FileEvent) => void` | This is notified when a file was added into the directory.
| `remove` | `(event: FileEvent) => void` | This is notified when a file was removed from the directory.
| `change` | `(event: FileEvent) => void` | This is notified when a file in the directory was changed.
| `error` | `(error: Error) => void` | This is notified when an error happens while watching.

**Example:**

```js
import { watchFiles } from "@mysticatea/fs-watcher"

;(async () => {
    // Start watching.
    const watcher = await watchFiles(["path/to/**/*.js", "path/to/**/*.ts"])

    // Listen events.
    watcher.on("add", event => {
        console.log("added:", event.path, event.stat)
    })
    watcher.on("remove", event => {
        console.log("removed:", event.path, event.stat)
    })
    watcher.on("change", event => {
        console.log("changed:", event.path, event.stat)
    })
    watcher.on("error", error => {
        console.error("error:", error)
    })

    // Stop watching.
    await watcher.close()
})()
```

## 📰 Changelog

- [GitHub Releases](https://github.com/mysticatea/fs-watcher/releases)

## ❤️ Contributing

Welcome contributing!

Please use GitHub's Issues/PRs.

### Development Tools

- `npm test` runs tests and measures coverage.
- `npm run build` compiles TypeScript source code to `index.js`, `index.js.map`, and `index.d.ts`.
- `npm run coverage` shows the coverage result of `npm test` command with the default browser.
- `npm run clean` removes the temporary files which are created by `npm test` and `npm run build`.
- `npm run watch` runs `npm test` on file changes.
