/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;

export function compose<R>(...funcs: AnyFn[]): R {
    if (funcs.length === 0) {
        throw new Error('compose requires at least one function');
    }

    const reversed = [...funcs].reverse();
    const composed = reversed.reduce((acc, fn) => {
        const next = fn(acc);
        Object.keys(acc).forEach((key) => {
            next[key] = acc[key];
        });
        return next;
    });

    (composed as unknown as { endpoint?: AnyFn }).endpoint = funcs[funcs.length - 1];
    return composed as R;
}
