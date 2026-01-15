import { StructRow } from 'apache-arrow';
import { ChartProps, Metric } from '../../types';

interface BigNumberProps extends ChartProps {
    metric: Metric;
    /*
     * When new attributes are added, they MUST have a default value,
     * so that saved charts continue to work with the old payload.
     */
}

interface BigNumberRow extends StructRow {
    source: string;
    [key: string]: unknown;  // dynamic metric name
}

function renderData(value: unknown): string | number {
    if (typeof value === 'number' || typeof value === 'string') return value;
    return 'Unexpected data';
}

export function BigNumber({ metric, dataFrame }: BigNumberProps) {
    const metricColumn = metric.value;
    const values = dataFrame.toArray() as BigNumberRow[];

    return (
        <div>
            {values.map((row: BigNumberRow) => (
                <>
                    <h1>{renderData(row[metricColumn])}</h1>
                    <h2>{row.source}</h2>
                </>
            ))}
        </div>
    );
}

BigNumber.metadata = {
    name: 'Big Number',
    description: 'Display a big number with a label',
    author: {name: 'Beto Dealmeida', email: 'contact@robida.net'},
    arguments: {
        metric: Metric,
    },
};
