import { Metric } from '../../types';

type BigNumberProps = {
    metric: Metric;
}

export function BigNumber({ metric }: BigNumberProps) {
    const value = metric.values?.[0];

    if (value === undefined) return <h1>no data</h1>;
    if (typeof value === 'number' || typeof value === 'string') return <h1>{value}</h1>;

    return <h1>unexpected data</h1>;
}
