export function hook<TIn, TOut>(fn: (next: TIn) => TOut): (next: TIn) => TOut {
    return fn;
}
