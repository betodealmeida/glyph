import { Table, StructRow } from 'apache-arrow';
import { Metric, GlyphTheme, ChartHooks } from '../../types';
import { createChart } from '../../createChart';

/**
 * BigNumber using pure reflection - the simplest possible API!
 *
 * Just write a function with semantic arguments.
 * No interfaces, no metadata, no duplication.
 */

interface DataRow extends StructRow {
    [key: string]: unknown;
}

function renderValue(value: unknown): string | number {
    if (typeof value === 'number' || typeof value === 'string') return value;
    return 'N/A';
}

// Define the render function as a regular function (not arrow)
// This works better with reflection
function renderBigNumber(
    dataFrame: Table,
    _theme: GlyphTheme | undefined,
    _width: number | undefined,
    _height: number | undefined,
    _hooks: ChartHooks | undefined,
    _datasourceColumns: Array<{ name: string; type?: string; is_dttm?: boolean }> | undefined,
    metric: Metric
): React.ReactNode {
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

// This is it! The entire chart definition:
export const BigNumber = createChart(
    'Glyph Big Number',
    renderBigNumber,
    { description: 'Display a big number with a label' }
);
