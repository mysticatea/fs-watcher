/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import fs from "fs"

/**
 * The information of file changes.
 */
export interface FileEvent {
    /** The path to the changed file. */
    path: string

    /** The stats of the changed file. */
    stat: fs.Stats
}
