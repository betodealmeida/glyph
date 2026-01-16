import { Table } from 'apache-arrow';
import { Metric, DataRow } from '../../types';
import { createChart } from '../../createChart';

/**
 * Format a number for display (2 decimal places, with thousands separators).
 */
function formatNumber(value: unknown): string {
    if (typeof value === 'number') {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
    if (typeof value === 'string') return value;
    return 'N/A';
}

/**
 * BigNumber - The simplest possible Glyph chart.
 *
 * Just declare the parameters you need. No boilerplate required.
 */
function renderBigNumber(dataFrame: Table, metric: Metric): React.ReactNode {
    const metricColumn = metric?.value;
    const values = dataFrame?.toArray() as DataRow[] || [];

    // Show placeholder when metric is not configured
    if (!metricColumn || metricColumn === 'value') {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Select a metric to display
            </div>
        );
    }

    // Show placeholder when no data
    if (values.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h1 style={{ opacity: 0.5 }}>N/A</h1>
            </div>
        );
    }

    return (
        <div>
            {values.map((row, i) => (
                <div key={i}>
                    <h1>{formatNumber(row[metricColumn])}</h1>
                </div>
            ))}
        </div>
    );
}

export const BigNumber = createChart(
    'Glyph Big Number',
    renderBigNumber,
    { description: 'Display a big number with a label' }
);
