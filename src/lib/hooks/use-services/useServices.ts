import { isFunction, objectify, parallel } from 'radash';
import type { NextFunc, Props } from '../../core';

export type ServiceFactory<T> = T | Promise<T> | ((props: Props) => T) | ((props: Props) => Promise<T>);

export type ServiceMap<TServices extends Record<string, unknown>> = {
    [K in keyof TServices]: ServiceFactory<TServices[K]>;
};

async function withServices<TServices extends Record<string, unknown>>(
    func: NextFunc<Props<Record<string, unknown>, TServices>>,
    serviceMap: ServiceMap<TServices>,
    props: Props,
): Promise<unknown> {
    const keys = Object.keys(serviceMap) as Array<keyof TServices & string>;
    const resolvedList = await parallel(10, keys, async (key) => {
        const entry = serviceMap[key];
        const value = await Promise.resolve(
            isFunction(entry) ? (entry as (p: Props) => unknown)(props) : entry,
        );
        return { key, value };
    });

    const resolvedServices = objectify(
        resolvedList,
        (item) => item.key,
        (item) => item.value,
    ) as TServices;

    return await func({
        ...props,
        services: {
            ...props.services,
            ...resolvedServices,
        } as TServices,
    });
}

export const useServices =
    <TServices extends Record<string, unknown>>(serviceMap: ServiceMap<TServices>) =>
    (func: NextFunc<Props<Record<string, unknown>, TServices>>): NextFunc<Props> =>
    (props: Props) =>
        withServices(func, serviceMap, props);
