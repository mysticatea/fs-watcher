/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import { Stats } from "fs"
import { FileEvent } from "./file-event"

/**
 * The watcher which notifies events of the files in a directory.
 */
export interface Watcher extends NodeJS.EventEmitter {
    /** The stats for each file this watcher is handling. */
    readonly stats: ReadonlyMap<string, Stats>

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
