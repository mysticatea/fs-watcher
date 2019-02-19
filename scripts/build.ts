import cp from "child_process"
import path from "path"
import fs from "fs-extra"
import log from "fancy-log"

// Main
;(async () => {
    log.info("BUILD started:")

    await fs.remove(".temp")
    await fs.remove("index.*")
    await exec("tsc --module es2015 --target es2018")
    await exec("rollup -c")
    await exec("dts-bundle-generator src/index.ts -o index.d.ts")

    // remove `/// <reference types="mocha" />`
    const indexDts = await fs.readFile("index.d.ts", "utf8")
    await fs.writeFile(
        "index.d.ts",
        indexDts.replace('/// <reference types="mocha" />\n', ""),
    )

    log.info("BUILD completed:")
})().catch(error => {
    process.exitCode = 1
    log.error(error.stack)
})

function exec(commandLine: string): Promise<void> {
    return new Promise((resolve, reject) => {
        log(">", commandLine)

        const [command, ...args] = commandLine.split(" ")
        const child = cp
            .spawn(
                `.${path.sep}node_modules${path.sep}.bin${path.sep}${command}`,
                args,
                {
                    shell: true,
                    stdio: "inherit",
                },
            )
            .on("close", code => {
                if (code) {
                    reject(new Error(`Exited with '${code}'.`))
                } else {
                    resolve()
                }
                dispose()
            })
            .on("error", error => {
                reject(error)
                dispose()
            })

        const kill = (signal?: string) => {
            child.kill(signal)
        }
        const dispose = () => {
            process.removeListener("SIGINT", kill)
            process.removeListener("SIGKILL", kill)
        }

        process.on("SIGINT", kill)
        process.on("SIGKILL", kill)
    })
}
