/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
import { Watcher, FileEvent } from "../../src"

const TIMEOUT = 667

/**
 * Wait for a given time.
 * @param timeout The timeout in milliseconds.
 */
export function delay(timeout: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * Assert that a given code block rejects with a given error.
 * @param block The code block to assert.
 * @param error The expected error information.
 */
export async function assertRejects(
    block: Promise<any> | (() => Promise<any>),
    error: { [key: string]: any },
): Promise<void> {
    try {
        await (typeof block === "function" ? block() : block)
    } catch (actualError) {
        for (const key of Object.keys(error)) {
            assert.strictEqual(
                error[key],
                actualError[key],
                `'error.${key}' was unexpected.`,
            )
        }
        return
    }
    throw new assert.AssertionError({ message: "Should reject." })
}

/**
 * The tester for watchers.
 */
export class Tester {
    private _watcher: Watcher
    private _events: {
        type: "add" | "remove" | "change"
        event: FileEvent
    }[] = []
    private _waitings: {
        type: "add" | "remove" | "change"
        resolve: (event: FileEvent) => void
    }[] = []

    /**
     * @param watcher The watcher to listen.
     */
    public constructor(watcher: Watcher) {
        this._watcher = watcher
        watcher.on("add", this._onEvent.bind(this, "add"))
        watcher.on("remove", this._onEvent.bind(this, "remove"))
        watcher.on("change", this._onEvent.bind(this, "change"))
        watcher.on("error", error => {
            throw error
        })
    }

    /**
     * Close the watcher.
     */
    public close(): Promise<void> {
        return this._watcher.close()
    }

    /**
     * Wait for a given event.
     * @param type The event type to wait for.
     */
    public waitFor(type: "add" | "remove" | "change"): Promise<FileEvent> {
        return new Promise<FileEvent>(resolve => {
            const waiting = {
                type,
                resolve: (event: FileEvent): void => {
                    const i = this._waitings.indexOf(waiting)
                    if (i >= 0) {
                        this._waitings.splice(i, 1)
                    }
                    resolve(event)
                },
            }
            setTimeout(waiting.resolve, TIMEOUT)

            this._waitings.push(waiting)
        })
    }

    /**
     * Count the number of events.
     */
    public async getEvents(events: Tester.FileEvents): Promise<void> {
        await delay(700)

        events.add.length = 0
        events.remove.length = 0
        events.change.length = 0

        for (const { type, event } of this._events) {
            events[type].push(event)
        }
    }

    /**
     * The callback which will be called when the watcher notified events.
     * @param type The type of the notified event.
     * @param event The notified event.
     */
    private _onEvent(type: "add" | "remove" | "change", event: FileEvent) {
        this._events.push({ type, event })

        for (const waiting of Array.from(this._waitings)) {
            if (waiting.type === type) {
                waiting.resolve(event)
            }
        }
    }
}

export namespace Tester {
    export type FileEvents = {
        add: FileEvent[]
        remove: FileEvent[]
        change: FileEvent[]
    }
}
