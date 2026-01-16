import { Table } from 'apache-arrow';
import { Metric, DataRow, renderValue } from '../../types';
import { createChart } from '../../createChart';

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
                    <h1>{renderValue(row[metricColumn])}</h1>
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
