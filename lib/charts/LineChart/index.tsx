import { useEffect, useRef } from 'react';
import { Table } from 'apache-arrow';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Metric, Temporal, Dimension, GlyphTheme, defaultTheme, ChartHooks } from '../../types';
import { createChart } from '../../createChart';

// Color palette for multiple series
const COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

/**
 * Convert a value to a Unix timestamp in seconds.
 * Handles various formats: Unix timestamps, milliseconds, Date objects, ISO strings, and year-only values.
 */
function toTimestamp(value: unknown): number {
    if (value == null) return 0;

    if (value instanceof Date) {
        return value.getTime() / 1000;
    }

    if (typeof value === 'number') {
        // Year-only values (e.g., 1980, 2020) - convert to Jan 1 of that year
        if (value >= 1900 && value <= 2100) {
            return new Date(value, 0, 1).getTime() / 1000;
        }
        // Milliseconds (> 100 billion, which covers dates from ~1973 onwards in ms)
        if (value > 1e11) {
            return value / 1000;
        }
        // Already Unix timestamp in seconds
        return value;
    }

    if (typeof value === 'string') {
        // Try to parse as year-only
        const yearMatch = value.match(/^\d{4}$/);
        if (yearMatch) {
            const year = parseInt(value, 10);
            return new Date(year, 0, 1).getTime() / 1000;
        }
        // Try to parse as date string
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed / 1000;
    }

    return 0;
}

/**
 * LineChart - A time series line chart using uPlot.
 */
function renderLineChart(
    dataFrame: Table,
    theme: GlyphTheme | undefined,
    width: number | undefined,
    height: number | undefined,
    _hooks: ChartHooks | undefined,
    _datasourceColumns: Array<{ name: string; type?: string; is_dttm?: boolean }> | undefined,
    time: Temporal,
    metric: Metric,
    groupBy?: Dimension
): React.ReactNode {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<uPlot | null>(null);
    const currentTheme = theme || defaultTheme;
    const chartWidth = width || 800;
    const chartHeight = height || 400;

    const timeColumn = time?.value;
    const metricColumn = metric?.value;

    // Check if chart is configured
    const isConfigured = timeColumn && timeColumn !== '__timestamp' &&
                         metricColumn && metricColumn !== 'value';
    const rows = dataFrame?.toArray() || [];
    const hasData = rows.length > 0;

    useEffect(() => {
        if (!containerRef.current || !dataFrame || !isConfigured || !hasData) return;

        const groupColumn = groupBy?.value;
        const rows = dataFrame.toArray();

        let uplotData: uPlot.AlignedData;
        let series: uPlot.Series[];

        if (groupColumn) {
            // Group by dimension - create multiple series
            const groups = new Map<string, { times: number[]; values: number[] }>();

            for (const row of rows) {
                const timestamp = toTimestamp(row[timeColumn]);
                // Skip invalid timestamps (0 = 1970-01-01, likely null/invalid data)
                if (timestamp === 0) continue;

                const groupValue = String(row[groupColumn] ?? 'Unknown');
                const value = Number(row[metricColumn]) || 0;

                if (!groups.has(groupValue)) {
                    groups.set(groupValue, { times: [], values: [] });
                }
                const group = groups.get(groupValue)!;
                group.times.push(timestamp);
                group.values.push(value);
            }

            // Build aligned data - need to merge all timestamps
            const allTimestamps = new Set<number>();
            for (const group of groups.values()) {
                for (const t of group.times) {
                    allTimestamps.add(t);
                }
            }
            const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

            // Create data arrays with nulls for missing points
            const dataArrays: (number | null)[][] = [sortedTimestamps];
            series = [{}]; // x-axis series config

            let colorIndex = 0;
            for (const [groupName, group] of groups) {
                const timeToValue = new Map<number, number>();
                for (let i = 0; i < group.times.length; i++) {
                    const t = group.times[i];
                    const v = group.values[i];
                    if (t !== undefined && v !== undefined) {
                        timeToValue.set(t, v);
                    }
                }

                const values: (number | null)[] = sortedTimestamps.map(t => {
                    const v = timeToValue.get(t);
                    return v !== undefined ? v : null;
                });
                dataArrays.push(values);

                series.push({
                    label: groupName,
                    stroke: COLORS[colorIndex % COLORS.length],
                    width: 2,
                    spanGaps: true,
                });
                colorIndex++;
            }

            uplotData = dataArrays as uPlot.AlignedData;
        } else {
            // Single series
            const dataPoints: { t: number; v: number }[] = [];

            for (const row of rows) {
                const timestamp = toTimestamp(row[timeColumn]);
                // Skip invalid timestamps
                if (timestamp === 0) continue;
                dataPoints.push({
                    t: timestamp,
                    v: Number(row[metricColumn]) || 0,
                });
            }

            // Sort by timestamp
            const sorted = dataPoints.sort((a, b) => a.t - b.t);

            uplotData = [
                sorted.map(d => d.t),
                sorted.map(d => d.v),
            ];

            series = [
                {},
                {
                    label: metric?.value || 'Value',
                    stroke: COLORS[0],
                    width: 2,
                },
            ];
        }

        const opts: uPlot.Options = {
            width: chartWidth,
            height: chartHeight,
            series,
            scales: {
                x: { time: true },
            },
            axes: [
                {
                    stroke: currentTheme.colors.text,
                    grid: { stroke: currentTheme.colors.gridLine },
                    ticks: { stroke: currentTheme.colors.border },
                    font: `12px ${currentTheme.fontFamily}`,
                },
                {
                    label: metric?.value || 'Value',
                    stroke: currentTheme.colors.text,
                    grid: { stroke: currentTheme.colors.gridLine },
                    ticks: { stroke: currentTheme.colors.border },
                    font: `12px ${currentTheme.fontFamily}`,
                },
            ],
            legend: {
                show: true,
            },
        };

        // Don't create chart if dimensions are invalid
        if (chartWidth === 0 || chartHeight === 0) {
            return;
        }

        // Clean up previous chart
        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }

        chartRef.current = new uPlot(opts, uplotData, containerRef.current);

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [dataFrame, isConfigured, hasData, groupBy, currentTheme, chartWidth, chartHeight, timeColumn, metricColumn]);

    // Show placeholder when not configured
    if (!isConfigured) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: chartWidth,
                height: chartHeight,
                color: '#999',
                textAlign: 'center',
            }}>
                <div>
                    <div>Select a time column and metric to display</div>
                </div>
            </div>
        );
    }

    // Show placeholder when no data
    if (!hasData) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: chartWidth,
                height: chartHeight,
                color: '#999',
                textAlign: 'center',
            }}>
                <div>No data available</div>
            </div>
        );
    }

    return (
        <>
            <style>{`
                .glyph-line-chart .uplot,
                .glyph-line-chart .uplot * {
                    box-sizing: border-box !important;
                }
                .glyph-line-chart .uplot {
                    width: 100% !important;
                    height: 100% !important;
                }
                .glyph-line-chart .u-wrap {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                .glyph-line-chart .uplot canvas {
                    display: block !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                .glyph-line-chart .u-legend {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: ${currentTheme.colors.background}cc;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: ${currentTheme.fontFamily};
                    color: ${currentTheme.colors.text};
                    z-index: 10;
                }
                .glyph-line-chart .u-legend .u-series {
                    display: inline-block;
                    margin-right: 12px;
                }
                .glyph-line-chart .u-legend .u-marker {
                    width: 12px;
                    height: 3px;
                    display: inline-block;
                    margin-right: 4px;
                    vertical-align: middle;
                }
                .glyph-line-chart .u-legend .u-label {
                    vertical-align: middle;
                }
            `}</style>
            <div
                ref={containerRef}
                className="glyph-line-chart"
                style={{
                    width: chartWidth,
                    height: chartHeight,
                    overflow: 'hidden',
                    position: 'relative',
                }}
            />
        </>
    );
}

export const LineChart = createChart(
    'Glyph Line Chart',
    renderLineChart,
    {
        description: 'A time series line chart with optional grouping',
        category: 'Time Series',
        tags: ['line', 'time series', 'trend'],
    }
);
