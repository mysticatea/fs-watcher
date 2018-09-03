/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import { EventEmitter } from "events"
import path from "path"
import debounce from "debounce"
import debug from "debug"
import fs from "fs"
import { DirectoryWatcher } from "../directory-watcher"
import { getFiles, getStats } from "./utils"

const log = debug("fs-watcher:regular-directory-watcher")
const DEBOUNCE_INTERVAL = 200

enum State {
    Initializing,
    Alive,
    Disposed,
}

interface Operation {
    type: "add" | "change" | "remove"
    stat: fs.Stats
}

/**
 * The regular implementation of DirectoryWatcher.
 * This is using `fs.watch()` function.
 */
export class RegularDirectoryWatcher extends EventEmitter
    implements DirectoryWatcher {
    public readonly path: string
    public readonly ready: Promise<void>
    public readonly stats: Map<string, fs.Stats> = new Map()
    private readonly _queue: Map<string, Operation> = new Map()
    private readonly _watcher: fs.FSWatcher
    private _state = State.Initializing

    /**
     * Initialize this watcher.
     * @param config Normalized options.
     */
    public constructor(dirPath: string) {
        super()

        this.path = path.resolve(dirPath)
        this._watcher = fs
            .watch(this.path)
            .on("change", this._onChange.bind(this))
            .on("error", this._onError.bind(this))
        this.ready = this._open()
    }

    /**
     * Stop watching.
     */
    public close(): Promise<void> {
        log("RegularDirectoryWatcher#close", this.path)

        if (this._state !== State.Disposed) {
            this.stats.clear()
            this._queue.clear()
            this._watcher.close()
            this._watcher.removeAllListeners()
            this._state = State.Disposed
            ;(this._consumeQueue as any).clear()
        }

        return this.ready
    }

    /**
     * Start watching.
     */
    private async _open(): Promise<void> {
        log("RegularDirectoryWatcher#_open", this.path)
        try {
            // Enumerate files.
            const filenames = await getFiles(this.path)
            if (this._state === State.Disposed) {
                return
            }

            // Add those files.
            await Promise.all(
                filenames.map(this._onChange.bind(this, "rename")),
            )

            // Be ready.
            this._state = State.Alive
        } catch (error) {
            this.close()
            throw error
        }
    }

    /**
     * This is the event listener for the `change` event of `fs.Watcher`.
     * @param state The state of this watching.
     * @param eventType The event type of fs.Watcher.
     * @param filename The filename.
     */
    private async _onChange(
        eventType: string,
        filename: string | Buffer,
    ): Promise<void> {
        if (this._state === State.Disposed) {
            return
        }
        log("RegularDirectoryWatcher#_onChange", this.path, eventType, filename)

        const filePath = path.join(this.path, String(filename))
        const currStat = await getStats(filePath)
        const prevStat = this.stats.get(filePath)

        // @ts-ignore
        if (this._state === State.Disposed) {
            return
        }

        if (currStat != null) {
            this.stats.set(filePath, currStat)
            if (this._state === State.Alive) {
                if (prevStat == null) {
                    this._enqueueFileAsAdded(filePath, currStat)
                } else if (!currStat.isDirectory()) {
                    this._enqueueFileAsChanged(filePath, currStat)
                }
            }
        } else if (prevStat != null) {
            this.stats.delete(filePath)
            if (this._state === State.Alive) {
                this._enqueueFileAsRemoved(filePath, prevStat)
            }
        }
    }

    /**
     * This is the event listener for the `change` event of `fs.Watcher`.
     * @param state The state of this watching.
     * @param error The error object.
     */
    private _onError(error: Error): void {
        if (this._state === State.Disposed) {
            return
        }
        log("RegularDirectoryWatcher#_onError", this.path, error)

        this.emit("error", error)
    }

    /**
     * Enqueue the given file to copy it.
     * @param filePath The path to the target file.
     */
    private _enqueueFileAsAdded(filePath: string, stat: fs.Stats): void {
        log("RegularDirectoryWatcher#_enqueueFileAsAdded", filePath)

        // null -> add
        // add -> add
        // remove -> change
        // change -> change
        const entry = this._queue.get(filePath)
        const type = entry == null || entry.type === "add" ? "add" : "change"

        this._queue.set(filePath, { type, stat })
        this._consumeQueue()
    }

    /**
     * Enqueue the given file to remove it.
     * @param filePath The path to the target file.
     */
    private _enqueueFileAsRemoved(filePath: string, stat: fs.Stats): void {
        log("RegularDirectoryWatcher#_enqueueFileAsRemoved", filePath)

        // null -> remove
        // add -> null
        // remove -> remove
        // change -> remove
        const entry = this._queue.get(filePath)
        if (entry != null && entry.type === "add") {
            this._queue.delete(filePath)
        } else {
            this._queue.set(filePath, { type: "remove", stat })
        }

        this._consumeQueue()
    }

    /**
     * Enqueue the given file to copy it.
     * @param filePath The path to the target file.
     */
    private _enqueueFileAsChanged(filePath: string, stat: fs.Stats): void {
        log("RegularDirectoryWatcher#_enqueueFileAsChanged", filePath)

        // null -> change
        // add -> add
        // remove -> change
        // change -> change
        const entry = this._queue.get(filePath)
        const type = entry != null && entry.type === "add" ? "add" : "change"

        this._queue.set(filePath, { type, stat })
        this._consumeQueue()
    }

    /**
     * Consume all items in the operation queue.
     */
    private _consumeQueue(): void {
        log("RegularDirectoryWatcher#_consumeQueue")

        const entries = Array.from(this._queue)
        this._queue.clear()

        for (const [filePath, { type, stat }] of entries) {
            this.emit(type, { path: filePath, stat })
        }
    }
}

// @ts-ignore
RegularDirectoryWatcher.prototype._consumeQueue = debounce(
    // @ts-ignore
    RegularDirectoryWatcher.prototype._consumeQueue,
    DEBOUNCE_INTERVAL,
)
