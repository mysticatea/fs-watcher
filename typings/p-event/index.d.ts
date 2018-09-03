/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */

/** p-event package: https://github.com/sindresorhus/p-event */
declare module "p-event" {
    function pEvent<T = any>(
        emitter: pEvent.Emitter<T>,
        type: string,
        options?: pEvent.Options,
    ): Promise<T>

    namespace pEvent {
        interface Emitter<T> {
            on(type: string, listener: (event: T) => void): this
        }

        interface Options {
            rejectionEvents?: string[]
            timeout?: number
        }
    }

    export default pEvent
}
