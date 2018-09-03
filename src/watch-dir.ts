/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import { PollingDirectoryWatcher } from "./internal/polling-directory-watcher"
import { RegularDirectoryWatcher } from "./internal/regular-directory-watcher"
import { DirectoryWatcher } from "./directory-watcher"

/**
 * Start to watch a given directory to know changes.
 *
 * This function returns a watcher object. The watcher object will notify the
 * following events.
 *
 * - `add` ... when a certain file was added into the directory.
 * - `remove` ... when a certain file was removed from the directory.
 * - `change` ... when a certain file in the directory was changed.
 * - `error` ... when any error happens.
 *
 * The watcher use `fs.watch()` function by default to watch the changes.
 * But it uses `fs.watchFile()`/`fs.unwatchFile()` function pair if you gave
 * `options.pollingInterval` option.
 *
 * The watcher doesn't watch files recursively.
 * It watches only the direct children.
 *
 * If you want to stop watching, use `watcher.close()` method.
 *
 * @param dirPath The path to a directory to watch.
 * @param options The options.
 * @returns The watcher.
 */
export async function watchDir(
    dirPath: string,
    options?: watchDir.Options,
): Promise<DirectoryWatcher> {
    const interval = options && options.pollingInterval
    const watcher =
        typeof interval === "number"
            ? new PollingDirectoryWatcher(dirPath, interval)
            : new RegularDirectoryWatcher(dirPath)

    await watcher.ready

    return watcher
}

export namespace watchDir {
    /**
     * The options for `watchDir()` function.
     */
    export interface Options {
        /**
         * The polling interval in milliseconds.
         *
         * If this is `undefined` then the watcher uses `fs.watch()` function.
         * Otherwise, the watcher uses `fs.watchFile()`/`fs.unwatchFile()`
         * function pair.
         *
         * Default is `undefined`.
         */
        pollingInterval?: number
    }
}
