/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;

export function compose<R>(...funcs: AnyFn[]): R {
    if (funcs.length === 0) {
        throw new Error('compose requires at least one function');
    }

    const reversed = [...funcs].reverse();
    const composed = reversed.reduce((acc, fn) => {
        const next = fn(acc) as AnyFn;
        const accProps = acc as unknown as Record<string, unknown>;
        const nextProps = next as unknown as Record<string, unknown>;
        Object.keys(accProps).forEach((key) => {
            nextProps[key] = accProps[key];
        });
        return next;
    });

    (composed as unknown as Record<string, unknown>).endpoint = funcs[funcs.length - 1];
    return composed as R;
}
