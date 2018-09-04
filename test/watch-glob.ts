/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
import path from "path"
import fs from "fs-extra"
import { watchGlob } from "../src"
import { Tester } from "./internal/utils"

/** Verify. */
function verify(additionalOptions: watchGlob.Options): void {
    const WORKSPACE_PATH = path.resolve(__dirname, "../.test-ws")

    after(async () => {
        await fs.remove(WORKSPACE_PATH)
    })

    describe("when it's watching an existing directory,", () => {
        const ROOT_DIR = path.join(WORKSPACE_PATH, "existing")
        const options: watchGlob.Options = {
            cwd: ROOT_DIR,
            ...additionalOptions,
        }
        let watcher: Tester | null = null

        it("should not throw even if 'watcher.close()' is called twice.", async () => {
            await fs.remove(WORKSPACE_PATH)
            await fs.ensureDir(ROOT_DIR)

            watcher = new Tester(await watchGlob("**/*.txt", options))
            await watcher.close()
            await watcher.close()
        })

        for (const { subject, init } of [
            {
                subject: "with string pattern '**/*.txt',",
                init: () => watchGlob("**/*.txt", options),
            },
            {
                subject: "with string array pattern ['**/*.txt'],",
                init: () => watchGlob(["**/*.txt"], options),
            },
            {
                subject: "with object pattern {includes:['**/*.txt']},",
                init: () => watchGlob({ includes: ["**/*.txt"], ...options }),
            },
        ]) {
            describe(subject, () => {
                describe("when files are added,", () => {
                    const files = [
                        path.join(ROOT_DIR, "hello.txt"),
                        path.join(ROOT_DIR, "hello.bin"),
                    ]
                    const events: Tester.FileEvents = {
                        add: [],
                        remove: [],
                        change: [],
                    }

                    before(async () => {
                        await fs.remove(WORKSPACE_PATH)
                        await fs.ensureDir(ROOT_DIR)

                        // Start watching.
                        watcher = new Tester(await init())

                        // Create files then get events.
                        for (const file of files) {
                            fs.writeFile(file, "Hello")
                        }
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
                        assert.strictEqual(events.add[0].path, files[0])
                    })

                    it("should not notify 'remove' event.", () => {
                        assert.strictEqual(events.remove.length, 0)
                    })

                    it("should not notify 'change' event.", () => {
                        assert.strictEqual(events.change.length, 0)
                    })
                })
            })
        }
    })
}

describe.only("watchGlob function", () => {
    describe("with no option:", () => {
        verify({})
    })
    describe("with 'options.pollingInterval':", () => {
        verify({ pollingInterval: 200 })
    })
})
