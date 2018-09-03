/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import babel from "rollup-plugin-babel"
import resolve from "rollup-plugin-node-resolve"
import sourcemaps from "rollup-plugin-sourcemaps"

const pkg = require("./package.json")

export default {
    input: ".temp/src/index.js",
    output: [
        {
            file: "index.mjs",
            format: "es",
            sourcemap: true,
            sourcemapFile: "index.mjs.map",
            banner: `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */`,
        },
        {
            file: "index.js",
            format: "cjs",
            sourcemap: true,
            sourcemapFile: "index.js.map",
            banner: `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */`,
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
                    {
                        debug: true,
                        modules: false,
                        targets: { node: "6.5.0" },
                    },
                ],
            ],
        }),
    ],
    external: ["events", "fs", "path"].concat(Object.keys(pkg.dependencies)),
}
