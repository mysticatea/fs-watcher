import path from "path"
import * as micromatch from "micromatch"

/**
 * Resolve a given pattern if the pattern is relative.
 * @param cwdPattern The normalized path to the current working directory.
 * @param pattern The pattern to resolve.
 * @returns The resolved pattern.
 */
function resolve(cwdPattern: string, pattern: string): string {
    if (pattern.startsWith("/")) {
        return pattern
    }
    return path.posix.resolve(cwdPattern, pattern)
}

/**
 * Check whether a character is escaped or not.
 * @param text The text to check.
 * @param index The position of the character to check.
 * @returns `true` if the character is escaped.
 */
function isEscaped(text: string, index: number): boolean {
    let retv = false
    for (let i = index - 1; i >= 0 && text[i] === "\\"; --i) {
        retv = !retv
    }
    return retv
}

/**
 * Divide selections in glob pattern.
 * E.g., `/{src,test}/*.ts` is divided to `/src/*.ts` and `/test/*.ts`.
 * @param pattern The glob pattern to divide.
 * @param outPatterns The normalized patterns.
 */
function divideSelectionInGlob(pattern: string, outPatterns: string[]): void {
    const left = pattern.indexOf("{")
    if (left === -1 || isEscaped(pattern, left)) {
        outPatterns.push(pattern)
        return
    }

    const right = pattern.indexOf("}")
    if (right === -1 || isEscaped(pattern, right)) {
        outPatterns.push(pattern)
        return
    }

    for (const part of pattern.slice(left + 1, right).split(",")) {
        divideSelectionInGlob(
            pattern.slice(0, left) + part + pattern.slice(right + 1),
            outPatterns,
        )
    }
}

/**
 * Divide selections in glob pattern.
 * E.g., `/{src,test}/*.ts` is divided to `/src/*.ts` and `/test/*.ts`.
 *
 * This helps to reduce directories the watcher watches because the base
 * directory of the patterns gets more specific.
 *
 * @param pattern The glob pattern to divide.
 * @returns The normalized patterns.
 */
function normalizeGlobPatternsPosix(
    cwd: string,
    patterns: ReadonlyArray<string>,
): string[] {
    const retv: string[] = []
    const basePattern = normalizePathPosix(cwd)
    for (const pattern of patterns) {
        divideSelectionInGlob(resolve(basePattern, pattern), retv)
    }
    return retv
}

/**
 * Divide selections in glob pattern.
 * E.g., `/{src,test}/*.ts` is divided to `/src/*.ts` and `/test/*.ts`.
 *
 * This helps to reduce directories the watcher watches because the base
 * directory of the patterns gets more specific.
 *
 * @param pattern The glob pattern to divide.
 * @returns The normalized patterns.
 */
function normalizeGlobPatternsWin32(
    cwd: string,
    patterns: ReadonlyArray<string>,
): string[] {
    const retv: string[] = []
    const basePattern = normalizePathWin32(cwd)
    for (const pattern of patterns) {
        divideSelectionInGlob(
            resolve(
                basePattern,
                pattern.includes("/") ? pattern : normalizePathWin32(pattern),
            ),
            retv,
        )
    }
    return retv
}

export const normalizeGlobPatterns =
    path.sep === "/" ? normalizeGlobPatternsPosix : normalizeGlobPatternsWin32

/**
 * Convert a given path to use glob.
 * @param originalPath The absolute path to convert.
 * @returns The normalized path.
 */
function normalizePathPosix(originalPath: string): string {
    if (originalPath.endsWith("/") && originalPath !== "/") {
        return originalPath.slice(0, -1)
    }
    return originalPath || "."
}

/**
 * Convert a given path to use glob.
 * Glob doesn't support the file delimiter of Windows.
 * @param originalPath The path to convert.
 * @returns The normalized path.
 */
function normalizePathWin32(originalPath: string): string {
    const absoluteLikePath = originalPath.replace(/\\/gu, "/")
    const absolutePath = /^[a-z]:/iu.test(absoluteLikePath)
        ? `/${absoluteLikePath}`
        : absoluteLikePath

    // If it's only a drive letter, it needs the trailing slash.
    // if (/^[a-z]:$/i.test(absolutePath)) {
    //     return `${absolutePath}/`
    // }

    return normalizePathPosix(absolutePath)
}

const normalizePath = path.sep === "/" ? normalizePathPosix : normalizePathWin32

/**
 * Returns false always.
 */
function alwaysFalse(): boolean {
    return false
}

/**
 * The predicate of the file matcher.
 */
function isMatch1(
    this: { includes: ((str: string) => boolean)[] },
    filePath: string,
): boolean {
    const relPath = normalizePath(filePath)
    for (const f of this.includes) {
        if (f(relPath)) {
            return true
        }
    }
    return false
}

/**
 * The predicate of the file matcher.
 */
function isMatch2(
    this: {
        includes: ((str: string) => boolean)[]
        excludes: ((str: string) => boolean)[]
    },
    filePath: string,
): boolean {
    const relPath = normalizePath(filePath)
    for (const f of this.includes) {
        if (f(relPath)) {
            let matched = false
            for (const g of this.excludes) {
                if (g(relPath)) {
                    matched = true
                    break
                }
            }
            if (!matched) {
                return true
            }
        }
    }
    return false
}

/**
 * Create micromatch pattern matcher.
 * @param pattern The pattern to create.
 */
function createMatcher(pattern: string): (str: string) => boolean {
    return micromatch.matcher(pattern)
}

/**
 * Create the file matcher.
 * @param positivePatterns The glob patterns of the target files.
 * @param negativePatterns The glob patterns of ignored files.
 */
export function createFileMatcher(
    positivePatterns: ReadonlyArray<string>,
    negativePatterns: ReadonlyArray<string>,
): (str: string) => boolean {
    if (positivePatterns.length === 0) {
        return alwaysFalse
    }

    const includes = positivePatterns.map(createMatcher)
    if (negativePatterns.length === 0) {
        return isMatch1.bind({ includes })
    }

    const excludes = negativePatterns.map(createMatcher)
    return isMatch2.bind({ includes, excludes })
}

/**
 * Create the matcher to skip the directories which never match the files in there.
 * @param negativePatterns The glob patterns of ignored files.
 */
export function createSkipMatcher(
    negativePatterns: ReadonlyArray<string>,
): (str: string) => boolean {
    if (negativePatterns.length === 0) {
        return alwaysFalse
    }
    const includes: ((str: string) => boolean)[] = []

    for (const pattern of negativePatterns) {
        if (pattern.endsWith("/**") && pattern !== "/**") {
            includes.push(createMatcher(pattern.slice(0, -3)))
        }
        includes.push(createMatcher(pattern))
    }

    return isMatch1.bind({ includes })
}
