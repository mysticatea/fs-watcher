/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
import path from "path"
import fs from "fs-extra"
import { Watcher, watchDir } from "../src"
import { Tester } from "./internal/utils"

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

        describe("when a file is added,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is added,", () => {
            const dirPath = path.join(ROOT_DIR, "hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is removed,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is removed,", () => {
            const dirPath = path.join(ROOT_DIR, "hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is changed,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is changed,", () => {
            const dirPath = path.join(ROOT_DIR, "hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is added into the parent directory,", () => {
            const filePath = path.join(WORKSPACE_PATH, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is added into the parent directory,", () => {
            const dirPath = path.join(WORKSPACE_PATH, "hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is removed from the parent directory,", () => {
            const filePath = path.join(WORKSPACE_PATH, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is removed from the parent directory,", () => {
            const dirPath = path.join(WORKSPACE_PATH, "hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is changed on the parent directory,", () => {
            const filePath = path.join(WORKSPACE_PATH, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is changed on the parent directory,", () => {
            const dirPath = path.join(WORKSPACE_PATH, "hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is added into a child directory,", () => {
            const filePath = path.join(ROOT_DIR, "child/hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is added into a child directory,", () => {
            const dirPath = path.join(ROOT_DIR, "child/hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is removed from a child directory,", () => {
            const filePath = path.join(ROOT_DIR, "child/hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is removed from a child directory,", () => {
            const dirPath = path.join(ROOT_DIR, "child/hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is changed on a child directory,", () => {
            const filePath = path.join(ROOT_DIR, "child/hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a directory is changed on a child directory,", () => {
            const dirPath = path.join(ROOT_DIR, "child/hello")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is added then is removed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is added then is changed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is removed then is added immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is changed then is removed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

        describe("when a file is changed then is changed immediately,", () => {
            const filePath = path.join(ROOT_DIR, "hello.txt")
            const events: Tester.FileEvents = {
                add: [],
                remove: [],
                change: [],
            }

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

    describe("when it tried to watch a non directory,", () => {
        const filePath = path.join(WORKSPACE_PATH, "hello.txt")
        let watcher: Watcher | null = null

        before(async () => {
            await fs.remove(WORKSPACE_PATH)
            await fs.ensureDir(WORKSPACE_PATH)
            await fs.writeFile(filePath, "Hello")
        })
        after(async () => {
            if (watcher) {
                await watcher.close()
                watcher = null
            }
        })

        it("should throw ENOTDIR error.", async () => {
            try {
                watcher = await watchDir(filePath, options)
            } catch (error) {
                assert.strictEqual(error.code, "ENOTDIR")
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
