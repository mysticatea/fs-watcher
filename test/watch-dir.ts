/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
import path from "path"
import fs from "fs-extra"
import { Watcher, FileEvent, watchDir } from "../src"
import { delay } from "./internal/utils"

type FileEvents = {
    add: FileEvent[]
    remove: FileEvent[]
    change: FileEvent[]
}

const TIMEOUT = 700

/** The event listener for the watcher. */
class Tester {
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
    public async getEvents(events: FileEvents): Promise<void> {
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

/** Verify. */
function verify(options: watchDir.Options): void {
    const WORKSPACE_PATH = path.resolve(__dirname, "../.test-ws")

    after(async () => {
        await fs.remove(WORKSPACE_PATH)
    })

    describe("when it's watching an existing directory,", () => {
        const ROOT_DIR = path.join(WORKSPACE_PATH, "existing")
        let watcher: Tester | null = null

        it("should not throw even if 'watcher.close()' is called twice.", async () => {
            await fs.remove(WORKSPACE_PATH)
            await fs.ensureDir(ROOT_DIR)

            watcher = new Tester(await watchDir(ROOT_DIR, options))
            await watcher.close()
            await watcher.close()
        })

        describe("when a file added,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create a file then get events.
                fs.writeFile(filePath, "Hello")
                await watcher.waitFor("add")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 1)
                assert.strictEqual(events.add[0].path, filePath)
                assert.strictEqual(events.add[0].stat.size, 5)
                assert.strictEqual(events.add[0].stat.isFile(), true)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory added,", () => {
            const dirPath = path.join(ROOT_DIR, "hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create a directory then get events.
                fs.mkdir(dirPath)
                await watcher.waitFor("add")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 1)
                assert.strictEqual(events.add[0].path, dirPath)
                assert.strictEqual(events.add[0].stat.size, 0)
                assert.strictEqual(events.add[0].stat.isDirectory(), true)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file removed,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove the file then get events.
                fs.remove(filePath)
                await watcher.waitFor("remove")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 1)
                assert.strictEqual(events.remove[0].path, filePath)
                assert.strictEqual(events.remove[0].stat.size, 5)
                assert.strictEqual(events.remove[0].stat.isFile(), true)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory removed,", () => {
            const dirPath = path.join(ROOT_DIR, "hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a directory.
                await fs.mkdir(dirPath)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove the file then get events.
                fs.remove(dirPath)
                await watcher.waitFor("remove")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 1)
                assert.strictEqual(events.remove[0].path, dirPath)
                assert.strictEqual(events.remove[0].stat.size, 0)
                assert.strictEqual(events.remove[0].stat.isDirectory(), true)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file changed,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the file then get events.
                fs.writeFile(filePath, "Hello, World!")
                await watcher.waitFor("change")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 1)
                assert.strictEqual(events.change[0].path, filePath)
                assert.strictEqual(events.change[0].stat.size, 13)
                assert.strictEqual(events.change[0].stat.isFile(), true)
            })
        })

        describe("when a directory changed,", () => {
            const dirPath = path.join(ROOT_DIR, "hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a directory.
                await fs.mkdir(dirPath)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the directory then get events.
                fs.mkdir(path.join(dirPath, "world"))
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file added into the parent directory,", () => {
            const filePath = path.join(WORKSPACE_PATH, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create a file then get events.
                fs.writeFile(filePath, "Hello")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory added into the parent directory,", () => {
            const dirPath = path.join(WORKSPACE_PATH, "hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create a directory then get events.
                fs.mkdir(dirPath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file removed from the parent directory,", () => {
            const filePath = path.join(WORKSPACE_PATH, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove the file then get events.
                fs.remove(filePath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory removed from the parent directory,", () => {
            const dirPath = path.join(WORKSPACE_PATH, "hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a directory.
                await fs.mkdir(dirPath)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove the directory then get events.
                fs.remove(dirPath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file changed on the parent directory,", () => {
            const filePath = path.join(WORKSPACE_PATH, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the file then get events.
                fs.writeFile(filePath, "Hello, World!")
                await watcher.waitFor("change")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory changed on the parent directory,", () => {
            const dirPath = path.join(WORKSPACE_PATH, "hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a directory.
                await fs.mkdir(dirPath)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the directory then get events.
                fs.mkdir(path.join(dirPath, "world"))
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file added into a child directory,", () => {
            const filePath = path.join(ROOT_DIR, "child/hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a child directory.
                await fs.mkdir(path.dirname(filePath))

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create a file then get events.
                fs.writeFile(filePath, "Hello")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory added into a child directory,", () => {
            const dirPath = path.join(ROOT_DIR, "child/hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a child directory.
                await fs.mkdir(path.dirname(dirPath))

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create a directory then get events.
                fs.mkdir(dirPath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file removed from a child directory,", () => {
            const filePath = path.join(ROOT_DIR, "child/hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.mkdir(path.dirname(filePath))
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove the file then get events.
                fs.remove(filePath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory removed from a child directory,", () => {
            const dirPath = path.join(ROOT_DIR, "child/hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a directory into a child directory.
                await fs.mkdir(path.dirname(dirPath))
                await fs.mkdir(dirPath)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove the directory then get events.
                fs.remove(dirPath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file changed on a child directory,", () => {
            const filePath = path.join(ROOT_DIR, "child/hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.mkdir(path.dirname(filePath))
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the file then get events.
                fs.writeFile(filePath, "Hello, World!")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a directory changed on a child directory,", () => {
            const dirPath = path.join(ROOT_DIR, "child/hello")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a directory into a child directory.
                await fs.mkdir(path.dirname(dirPath))
                await fs.mkdir(dirPath)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the directory then get events.
                fs.mkdir(path.join(dirPath, "world"))
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file added then removed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create and remove a file then get events.
                await fs.writeFile(filePath, "Hello")
                await fs.remove(filePath)
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file added then changed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Create and change a file then get events.
                await fs.writeFile(filePath, "Hello")
                await fs.writeFile(filePath, "Hello, World!")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 1)
                assert.strictEqual(events.add[0].path, filePath)
                assert.strictEqual(events.add[0].stat.size, 13)
                assert.strictEqual(events.add[0].stat.isFile(), true)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should not notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file removed then added immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Remove and restore the file then get events.
                await fs.remove(filePath)
                await fs.writeFile(filePath, "Hello")
                await watcher.waitFor("change")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should notify 'change' event.", () => {
                assert.strictEqual(events.change.length, 1)
                assert.strictEqual(events.change[0].path, filePath)
                assert.strictEqual(events.change[0].stat.size, 5)
                assert.strictEqual(events.change[0].stat.isFile(), true)
            })
        })

        describe("when a file changed then removed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the file twice then get events.
                await fs.writeFile(filePath, "Hello, World!")
                await fs.remove(filePath)
                await watcher.waitFor("remove")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 1)
                assert.strictEqual(events.remove[0].path, filePath)
                assert.strictEqual(events.remove[0].stat.isFile(), true)

                // Polling mode cannot detect the change before the removal.
                if (typeof options.pollingInterval === "number") {
                    assert.strictEqual(events.remove[0].stat.size, 5)
                } else {
                    assert.strictEqual(events.remove[0].stat.size, 13)
                }
            })

            it("should notify 'change' event a time.", () => {
                assert.strictEqual(events.change.length, 0)
            })
        })

        describe("when a file changed then changed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: FileEvents = { add: [], remove: [], change: [] }

            before(async () => {
                await fs.remove(WORKSPACE_PATH)
                await fs.ensureDir(ROOT_DIR)

                // Create a file.
                await fs.writeFile(filePath, "Hello")

                // Start watching.
                watcher = new Tester(await watchDir(ROOT_DIR, options))

                // Change the file twice then get events.
                await fs.writeFile(filePath, "Hello, Wo")
                await fs.writeFile(filePath, "Hello, World!")
                await watcher.waitFor("change")
                await watcher.getEvents(events)
            })

            after(async () => {
                if (watcher) {
                    await watcher.close()
                    watcher = null
                }
            })

            it("should not notify 'add' event.", () => {
                assert.strictEqual(events.add.length, 0)
            })

            it("should not notify 'remove' event.", () => {
                assert.strictEqual(events.remove.length, 0)
            })

            it("should notify 'change' event a time.", () => {
                assert.strictEqual(events.change.length, 1)
                assert.strictEqual(events.change[0].path, filePath)
                assert.strictEqual(events.change[0].stat.size, 13)
                assert.strictEqual(events.change[0].stat.isFile(), true)
            })
        })
    })

    describe("when it tried to watch a non-existing directory,", () => {
        const dirPath = path.join(WORKSPACE_PATH, "non-existing")
        let watcher: Watcher | null = null

        before(async () => {
            await fs.remove(WORKSPACE_PATH)
            await fs.ensureDir(WORKSPACE_PATH)
        })
        after(async () => {
            if (watcher) {
                await watcher.close()
                watcher = null
            }
        })

        it("should throw ENOENT error.", async () => {
            try {
                watcher = await watchDir(dirPath, options)
            } catch (error) {
                assert.strictEqual(error.code, "ENOENT")
                return
            }
            assert.fail("should fail.")
        })
    })
}

describe("watchDir function", () => {
    describe("with no option:", () => {
        verify({})
    })
    describe("with 'options.pollingInterval':", () => {
        verify({ pollingInterval: 200 })
    })
})
