/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"

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
