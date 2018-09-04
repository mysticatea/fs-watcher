/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import { GlobWatcher } from "./internal/glob-watcher"
import { Watcher } from "./watcher"

/**
 * Check whether a given value is an Iterable object or not.
 * @param x The value to check.
 * @returns `true` if the value is an iterable object.
 */
function isIterable(x: any): x is Iterable<any> {
    return (
        x !== null &&
        typeof x === "object" &&
        typeof x[Symbol.iterator] === "function"
    )
}

export function watchGlob(
    pattern: string,
    options?: watchGlob.Options,
): Promise<Watcher>
export function watchGlob(
    patterns: Iterable<string>,
    options?: watchGlob.Options,
): Promise<Watcher>
export function watchGlob(config: watchGlob.Config): Promise<Watcher>

/**
 * Start to watch given glob patterns to know changes.
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
 * If you want to stop watching, use `watcher.close()` method.
 *
 * @param patternsOrConfig The glob patterns.
 * @param options The options.
 * @returns The watcher.
 */
export async function watchGlob(
    patternsOrConfig: string | Iterable<string> | watchGlob.Config,
    optionsOrNothing?: watchGlob.Options,
): Promise<Watcher> {
    const includes: string[] = []
    const excludes: string[] = []
    let options: watchGlob.Options | undefined

    // Process overloading.
    if (typeof patternsOrConfig === "string") {
        includes.push(patternsOrConfig)
        options = optionsOrNothing
    } else if (isIterable(patternsOrConfig)) {
        for (const pattern of patternsOrConfig) {
            if (pattern.startsWith("!")) {
                excludes.push(pattern.slice(1))
            } else {
                includes.push(pattern)
            }
        }
        options = optionsOrNothing
    } else {
        includes.push(...patternsOrConfig.includes)
        excludes.push(...(patternsOrConfig.excludes || []))
        options = patternsOrConfig
    }
    const cwd = (options && options.cwd) || process.cwd()
    const pollingInterval = options && options.pollingInterval

    // Start to watch the patterns.
    const watcher = new GlobWatcher({
        includes,
        excludes,
        cwd,
        pollingInterval,
    })
    await watcher.ready

    return watcher
}

export namespace watchGlob {
    /**
     * The options for `watchGlob()` function.
     */
    export interface Options {
        /**
         * The path to the current working directory.
         * This is the base of relative paths in glob patterns.
         *
         * Default is the value of `process.cwd()`.
         */
        cwd?: string

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

    /**
     * The config for `watchGlob()` function.
     */
    export interface Config extends Options {
        includes: ReadonlyArray<string>
        excludes?: ReadonlyArray<string>
    }
}
