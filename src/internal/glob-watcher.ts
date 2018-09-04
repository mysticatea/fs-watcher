/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import { EventEmitter } from "events"
import fs from "fs"
import path from "path"
import debug from "debug"
import globParent from "glob-parent"
import { FileEvent } from "../file-event"
import { watchDir } from "../watch-dir"
import { Watcher } from "../watcher"
import {
    createFileMatcher,
    createSkipMatcher,
    normalizeGlobPatterns,
} from "./utils/glob"

const log = debug("fs-watcher:glob-watcher")

enum State {
    Initializing,
    Alive,
    Disposed,
}

/**
 * Close a given watcher.
 * @param watcher The watcher to close.
 */
async function close(watcher: Watcher): Promise<void> {
    await watcher.close()
    watcher.removeAllListeners()
}

/**
 * Do nothing.
 */
function noop(): void {
    // Do nothing
}

/**
 * The watcher implementation to watch files.
 */
export class GlobWatcher extends EventEmitter implements Watcher {
    public readonly excludes: ReadonlyArray<string>
    public readonly includes: ReadonlyArray<string>
    public readonly pollingInterval: number | undefined
    public readonly ready: Promise<void>
    public readonly stats: Map<string, fs.Stats> = new Map()

    private readonly _isMatch: (str: string) => boolean
    private readonly _shouldSkip: (str: string) => boolean
    private readonly _watchers: Map<string, Promise<Watcher>> = new Map()
    private _state = State.Initializing

    /**
     * Initialize this watcher.
     * @param includes The glob patterns of the target files.
     * @param excludes The glob patterns of ignored files.
     * @param pollingInterval The polling interval to use legacy API.
     */
    public constructor(config: GlobWatcher.Config) {
        super()

        // Bind
        this._onAdd = this._onAdd.bind(this)
        this._onRemove = this._onRemove.bind(this)
        this._onChange = this._onChange.bind(this)
        this._onError = this._onError.bind(this)

        // Initialize
        this.includes = normalizeGlobPatterns(config.cwd, config.includes)
        this.excludes = normalizeGlobPatterns(config.cwd, config.excludes)
        this.pollingInterval = config.pollingInterval
        this._isMatch = createFileMatcher(this.includes, this.excludes)
        this._shouldSkip = createSkipMatcher(this.excludes)

        // Start
        this.ready = this._open()
    }

    /**
     * Stop watching.
     */
    public async close(): Promise<void> {
        log("GlobWatcher#close", this.includes, this.excludes)

        if (this._state !== State.Disposed) {
            this.stats.clear()

            const promises: Promise<void>[] = []
            for (const watcherPromise of this._watchers.values()) {
                promises.push(watcherPromise.then(close, noop))
            }
            this._watchers.clear()
            this._state = State.Disposed

            await Promise.all(promises)
        }

        await this.ready
    }

    /**
     * Start watching.
     */
    private async _open(): Promise<void> {
        log("GlobWatcher#_open", this.includes, this.excludes)
        try {
            // Add directories.
            await Promise.all(this.includes.map(this._openCore, this))
            if (this._state === State.Disposed) {
                return
            }

            // Be ready.
            this._state = State.Alive
        } catch (error) {
            this.close()
            throw error
        }
    }

    /**
     * Start watching.
     */
    private async _openCore(pattern: string): Promise<void> {
        log("GlobWatcher#_openCore", this.includes, this.excludes, pattern)

        const dirPath = globParent(pattern)
        if (this._state === State.Disposed) {
            return
        }

        await this._addDirectory(
            process.platform === "win32"
                ? path.resolve(dirPath.slice(1))
                : dirPath,
        )
    }

    /**
     * Start to watch a given directory, recursively.
     * @param dirPath The path to the directory to add.
     */
    private async _addDirectory(dirPath: string): Promise<void> {
        log("GlobWatcher#_addDirectory", this.includes, this.excludes, dirPath)

        if (this._watchers.has(dirPath) || this._shouldSkip(dirPath)) {
            return
        }

        const promise = this._addDirectoryCore(dirPath)
        this._watchers.set(dirPath, promise)

        await promise
    }

    /**
     * Start to watch a given directory, recursively.
     * @param dirPath The path to the directory to add.
     */
    private async _addDirectoryCore(dirPath: string): Promise<Watcher> {
        log(
            "GlobWatcher#_addDirectoryCore",
            this.includes,
            this.excludes,
            dirPath,
        )

        // Start to watch it.
        const watcher = await watchDir(dirPath, this)
        if (this._state === State.Disposed) {
            await watcher.close()
            return watcher
        }
        watcher.on("add", this._onAdd)
        watcher.on("remove", this._onRemove)
        watcher.on("change", this._onChange)
        watcher.on("error", this._onError)

        // Add child directories recursively.
        const promises: Promise<any>[] = []
        for (const [childPath, childStat] of watcher.stats) {
            if (childStat.isFile()) {
                this._addFile(childPath, childStat)
            } else if (childStat.isDirectory()) {
                promises.push(this._addDirectory(childPath))
            }
        }
        await Promise.all(promises)

        return watcher
    }

    /**
     * Start to watch a given directory, recursively.
     * @param dirPath The path to the directory to add.
     */
    private async _removeDirectory(dirPath: string): Promise<void> {
        log(
            "GlobWatcher#_removeDirectory",
            this.includes,
            this.excludes,
            dirPath,
        )

        const watcherPromise = this._watchers.get(dirPath)
        this._watchers.delete(dirPath)
        if (!watcherPromise) {
            return
        }

        const watcher = await watcherPromise
        const promises: Promise<any>[] = []

        // Remove children recursively.
        for (const [childPath, childStat] of watcher.stats) {
            if (childStat.isFile()) {
                this._removeFile(childPath)
            } else if (childStat.isDirectory()) {
                promises.push(this._removeDirectory(childPath))
            }
        }

        // Stop watching it.
        promises.push(watcher.close())
        await Promise.all(promises)

        // As a precaution.
        watcher.removeAllListeners()
    }

    /**
     * Add a file.
     */
    private _addFile(filePath: string, stat: fs.Stats): void {
        log("GlobWatcher#_addFile", this.includes, this.excludes, filePath)

        if (!this.stats.has(filePath) && this._isMatch(filePath)) {
            this.stats.set(filePath, stat)
            if (this._state === State.Alive) {
                this.emit("add", { path: filePath, stat })
            }
        }
    }

    /**
     * Remove a file.
     */
    private _removeFile(filePath: string): void {
        log("GlobWatcher#_removeFile", this.includes, this.excludes, filePath)

        const stat = this.stats.get(filePath)
        if (stat) {
            this.stats.delete(filePath)
            if (this._state === State.Alive) {
                this.emit("remove", { path: filePath, stat })
            }
        }
    }

    /**
     * Change a file.
     */
    private _changeFile(filePath: string, stat: fs.Stats): void {
        log("GlobWatcher#_changeFile", this.includes, this.excludes, filePath)

        if (this.stats.has(filePath)) {
            this.stats.set(filePath, stat)
            if (this._state === State.Alive) {
                this.emit("change", { path: filePath, stat })
            }
        }
    }

    /**
     * Called on a file or a directory is added.
     */
    private _onAdd(event: FileEvent): void {
        log("GlobWatcher#_onAdd", this.includes, this.excludes, event.path)
        if (this._state === State.Disposed) {
            return
        }

        try {
            if (event.stat.isFile()) {
                this._addFile(event.path, event.stat)
            } else if (event.stat.isDirectory()) {
                this._addDirectory(event.path).catch(this._onError)
            }
        } catch (error) {
            this._onError(error)
        }
    }

    /**
     * Called on a file or a directory is removed.
     */
    private _onRemove(event: FileEvent): void {
        log("GlobWatcher#_onRemove", this.includes, this.excludes, event.path)
        if (this._state === State.Disposed) {
            return
        }

        try {
            if (event.stat.isFile()) {
                this._removeFile(event.path)
            } else if (event.stat.isDirectory()) {
                this._removeDirectory(event.path).catch(this._onError)
            }
        } catch (error) {
            this._onError(error)
        }
    }

    /**
     * Called on a file or a directory is changed.
     */
    private _onChange(event: FileEvent): void {
        log("GlobWatcher#_onChange", this.includes, this.excludes, event.path)
        if (this._state === State.Disposed) {
            return
        }

        try {
            if (event.stat.isFile()) {
                this._changeFile(event.path, event.stat)
            }
        } catch (error) {
            this._onError(error)
        }
    }

    /**
     * Called on an error happens while watching.
     */
    private _onError(error: Error): void {
        log("GlobWatcher#_onError", this.includes, this.excludes, error)
        try {
            this.emit("error", error)
        } catch (emitError) {
            log("GlobWatcher#_onError :: an error handler threw, ", emitError)
        }
    }
}

export namespace GlobWatcher {
    export interface Config {
        includes: ReadonlyArray<string>
        excludes: ReadonlyArray<string>
        cwd: string
        pollingInterval: number | undefined
    }
}
