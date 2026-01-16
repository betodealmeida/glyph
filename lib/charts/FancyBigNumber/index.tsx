import { Table, StructRow } from 'apache-arrow';
import { Metric, Int, Color } from '../../types';
import { createChart } from '../../createChart';

interface DataRow extends StructRow {
    [key: string]: unknown;
}

function renderValue(value: unknown): string | number {
    if (typeof value === 'number' || typeof value === 'string') return value;
    return 'N/A';
}

// Define custom types - clean and simple!
class FontSize extends Int.with({ label: 'Font Size', min: 12, max: 200 }) {}
class FontColor extends Color.with({ label: 'Font Color', default: '#1f77b4' }) {}

/**
 * FancyBigNumber - a Big Number chart with customizable size and color.
 *
 * Demonstrates how Glyph can auto-generate Superset controls from
 * typed arguments using reflection.
 */
function renderFancyBigNumber(
    dataFrame: Table,
    metric: Metric,
    size: FontSize,
    color: FontColor
): React.ReactNode {
    // Debug: log what we received
    console.log('[FancyBigNumber] Props received:', { metric, size, color });

    // Handle undefined arguments gracefully
    const metricColumn = metric?.value || 'value';
    const fontSize = size?.numericValue ?? 48;
    const fontColor = color?.value || '#000000';
    const values = dataFrame?.toArray() as DataRow[] || [];

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
        }}>
            {values.map((row, i) => (
                <div key={i}>
                    <h1 style={{
                        fontSize: `${fontSize}px`,
                        color: fontColor,
                        margin: 0,
                        fontWeight: 'bold',
                    }}>
                        {renderValue(row[metricColumn])}
                    </h1>
                </div>
            ))}
        </div>
    );
}

export const FancyBigNumber = createChart(
    'Glyph Fancy Big Number',
    renderFancyBigNumber,
    { description: 'A Big Number with customizable font size and color' }
);
