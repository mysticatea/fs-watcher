/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import { EventEmitter } from "events"
import path from "path"
import debug from "debug"
import fs from "fs"
import { Watcher } from "../watcher"
import { getFiles, getStats } from "./utils"

const log = debug("fs-watcher:polling-directory-watcher")

type FileListener = (currStat: fs.Stats, prevStat: fs.Stats) => void
enum State {
    Initializing,
    Alive,
    Disposed,
}

/**
 * The polling implementation of DirectoryWatcher.
 * This is using `fs.watchFile()` function.
 */
export class PollingDirectoryWatcher extends EventEmitter implements Watcher {
    public readonly path: string
    public readonly pollingInterval: number
    public readonly ready: Promise<void>
    public readonly stats: Map<string, fs.Stats> = new Map()

    private readonly _listeners: Map<string, FileListener> = new Map()
    private _rdPromise: Promise<fs.Stats | null> = Promise.resolve(null)
    private _state = State.Initializing

    /**
     * Initialize this watcher.
     * @param config Normalized options.
     */
    public constructor(dirPath: string, pollingInterval: number) {
        super()

        this.path = path.resolve(dirPath)
        this.pollingInterval = pollingInterval
        this.ready = this._open()
    }

    /**
     * Stop watching.
     */
    public close(): Promise<void> {
        log("PollingDirectoryWatcher#close", this.path)

        if (this._state !== State.Disposed) {
            this.stats.clear()
            for (const [filePath, listener] of this._listeners) {
                fs.unwatchFile(filePath, listener)
            }
            this._listeners.clear()
            this._rdPromise = Promise.resolve(null)
            this._state = State.Disposed
        }

        return this.ready
    }

    /**
     * Start watching.
     */
    private async _open(): Promise<void> {
        log("PollingDirectoryWatcher#_open", this.path)
        try {
            await this._onChange(await getStats(this.path))
            this._watchFile(this.path, this._onChange.bind(this))
            this._state = State.Alive
        } catch (error) {
            this.close()
            throw error
        }
    }

    /**
     * This is the event listener for the `fs.watchFile`.
     * @param stat The stats of the watching directory.
     */
    private _onChange(stat: fs.Stats | null): Promise<fs.Stats | null> {
        if (this._state === State.Disposed) {
            return this._rdPromise
        }
        log("PollingDirectoryWatcher#_onChange", this.path)

        return (this._rdPromise = this._updateChildren(stat))
    }

    /**
     * Update the state of watching children.
     * @param stat The stats of the watching directory.
     */
    private async _updateChildren(
        stat: fs.Stats | null,
    ): Promise<fs.Stats | null> {
        log("PollingDirectoryWatcher#_updateChildren", this.path)

        const prevStat = await this._rdPromise
        const currStat =
            !stat || (stat.dev === 0 && stat.ino === 0) ? null : stat
        if (this._state === State.Disposed) {
            return currStat
        }
        if (prevStat && currStat && prevStat.mtime >= currStat.mtime) {
            return currStat
        }

        // Read files.
        const filenames = await getFiles(this.path)
        // @ts-ignore
        if (this._state === State.Disposed) {
            return currStat
        }

        // Detect added files.
        const remainingFilePaths = new Set(this.stats.keys())
        await Promise.all(
            /*eslint-disable array-callback-return, consistent-return */
            filenames.map(filename => {
                const filePath = path.join(this.path, filename)
                if (remainingFilePaths.delete(filePath)) {
                    return
                }
                return this._startWatchingChild(filePath)
            }),
            /*eslint-enable */
        )
        // @ts-ignore
        if (this._state === State.Disposed) {
            return currStat
        }

        // Detect removed files.
        for (const filePath of remainingFilePaths) {
            this._stopWatchingChild(filePath)
        }

        return currStat
    }

    /**
     * Start watching the change of a given file.
     * @param filePath The path to the file this watcher starts to watch.
     */
    private async _startWatchingChild(filePath: string): Promise<void> {
        log("PollingDirectoryWatcher#_startWatchingChild", filePath)

        // Get the initial stats.
        const stat = await getStats(filePath)
        if (stat == null || this._state === State.Disposed) {
            return
        }
        this.stats.set(filePath, stat)

        // Start watching.
        this._watchFile(filePath, this._onChildChange.bind(this, filePath))

        // Emit `add` event.
        if (this._state === State.Alive) {
            this.emit("add", { path: filePath, stat })
        }
    }

    /**
     * Stop watching the change of a given file.
     * @param filePath The path to the file this watcher stops watching.
     */
    private _stopWatchingChild(filePath: string): void {
        log("PollingDirectoryWatcher#_stopWatchingChild", filePath)

        const stat = this.stats.get(filePath)
        if (!stat) {
            return
        }

        // Remove stats.
        this.stats.delete(filePath)

        // Stop watching.
        this._unwatchFile(filePath)

        // Emit `remove` event.
        if (this._state === State.Alive) {
            this.emit("remove", { path: filePath, stat })
        }
    }

    /**
     * This is the event listener for the `fs.watchFile`.
     * @param filePath The path to the watching file.
     * @param stat The stats of the watching file.
     */
    private _onChildChange(filePath: string, stat: fs.Stats | null): void {
        if (this._state === State.Disposed) {
            return
        }
        log("PollingDirectoryWatcher#_onChildChange", filePath)

        const prevStat = this.stats.get(filePath)
        const currStat =
            !stat || (stat.dev === 0 && stat.ino === 0) ? null : stat

        if (prevStat && currStat && prevStat.mtime < currStat.mtime) {
            this.stats.set(filePath, currStat)

            // Emit `change` event.
            if (!currStat.isDirectory() && this._state === State.Alive) {
                this.emit("change", { path: filePath, stat: currStat })
            }
        }
    }

    /**
     * Register the change listener for a given file.
     * @param filePath The path to the file this watcher starts to watch.
     * @param listener The event listener.
     */
    private _watchFile(filePath: string, listener: FileListener): void {
        fs.watchFile(filePath, { interval: this.pollingInterval }, listener)
        this._listeners.set(filePath, listener)
    }

    /**
     * Unregiter the change listener for a given file.
     * @param filePath The path to the file this watcher stops watching.
     */
    private _unwatchFile(filePath: string): void {
        const listener = this._listeners.get(filePath)
        if (listener) {
            this._listeners.delete(filePath)
            fs.unwatchFile(filePath, listener)
        }
    }
}
