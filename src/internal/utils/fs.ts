import debug from "debug"
import fs from "fs"

const log = debug("fs-watcher:utils")

/**
 * Get filenames of the all files in a given directory.
 * @param dirPath The path to the target directory.
 * @returns The array of filenames.
 */
export function getFiles(dirPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(dirPath, (error, filenames) => {
            if (error) {
                reject(error)
            } else {
                resolve(filenames)
            }
        })
    })
}

/**
 * Get stats of a given file.
 * @param filePath The path to the target file.
 * @returns The stats object of the file.
 * If the file doesn't exist, returns null.
 */
export function getStatsWithoutError(
    filePath: string,
): Promise<fs.Stats | null> {
    return new Promise(resolve => {
        fs.stat(filePath, (error, stat) => {
            if (error && error.code !== "ENOENT") {
                log("Failed to get stats:", filePath)
                log(error)
            }
            resolve(stat || null)
        })
    })
}

/**
 * Get stats of a given file.
 * @param filePath The path to the target file.
 * @returns The stats object of the file.
 * If the file doesn't exist, returns null.
 */
export function getStats(filePath: string): Promise<fs.Stats> {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (error, stat) => {
            if (error) {
                reject(error)
            } else {
                resolve(stat)
            }
        })
    })
}
