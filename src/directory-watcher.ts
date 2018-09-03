/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import fs from "fs"
import { FileEvent } from "./file-event"

/**
 * The watcher which notifies events of the files in a directory.
 */
export interface DirectoryWatcher extends NodeJS.EventEmitter {
    /** The path to the directory this watcher is watching. */
    readonly path: string
    /** The stats for each file this watcher is handling. */
    readonly stats: Map<string, fs.Stats>

    /** Stop watching. */
    close(): Promise<void>

    /** @inheritdoc */
    addListener(type: "add", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    addListener(type: "remove", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    addListener(type: "change", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    addListener(type: "error", listener: (error: Error) => void): this

    /** @inheritdoc */
    on(type: "add", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    on(type: "remove", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    on(type: "change", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    on(type: "error", listener: (error: Error) => void): this

    /** @inheritdoc */
    once(type: "add", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    once(type: "remove", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    once(type: "change", listener: (event: FileEvent) => void): this
    /** @inheritdoc */
    once(type: "error", listener: (error: Error) => void): this
}
