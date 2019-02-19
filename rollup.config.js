/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import babel from "rollup-plugin-babel"
import resolve from "rollup-plugin-node-resolve"
import sourcemaps from "rollup-plugin-sourcemaps"

const pkg = require("./package.json")
const banner = `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
`

export default {
    input: ".temp/src/index.js",
    output: [
        {
            file: "index.mjs",
            format: "es",
            sourcemap: true,
            banner,
        },
        {
            file: "index.js",
            format: "cjs",
            sourcemap: true,
            banner,
        },
    ],
    plugins: [
        sourcemaps(),
        resolve(),
        babel({
            babelrc: false,
            presets: [
                [
                    "@babel/preset-env",
                    { modules: false, targets: { node: "6.5.0" } },
                ],
            ],
        }),
    ],
    external: ["events", "fs", "path"].concat(Object.keys(pkg.dependencies)),
}
