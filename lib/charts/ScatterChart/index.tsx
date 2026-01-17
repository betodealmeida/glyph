import { useState, useEffect } from 'react';
import { useDrop, DragObjectWithType, DropTargetMonitor } from 'react-dnd';
import { Table } from 'apache-arrow';
import { Metric, Dimension, Palette, GlyphTheme, DragItem, DragItemType, defaultTheme, ChartProps, ChartHooks, DataRow } from '../../types';
import { createChart, GlyphChart } from '../../createChart';
import { DropZone, ACCEPT_TYPE_MAP, convertToDragItem } from '../../components/DropZone';

/**
 * Axis data - either numeric or categorical.
 */
interface AxisData {
    isNumeric: boolean;
    // For numeric axes
    min?: number;
    max?: number;
    // For categorical axes
    categories?: string[];
    // Map from raw value to position (0 to 1)
    scale: (value: unknown) => number;
    // Get tick positions and labels
    ticks: { position: number; label: string }[];
}

/**
 * Analyze axis data and create scale/ticks.
 */
function analyzeAxisData(values: unknown[], padding: number = 0.1): AxisData {
    // Check if all values are numeric
    const numericValues = values.map(v => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            const parsed = parseFloat(v);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    });

    const allNumeric = numericValues.every(v => v !== null);

    if (allNumeric && numericValues.length > 0) {
        // Numeric axis
        const nums = numericValues as number[];
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const range = max - min || 1;
        const paddedMin = min - range * padding;
        const paddedMax = max + range * padding;
        const paddedRange = paddedMax - paddedMin;

        const ticks = generateTicks(paddedMin, paddedMax, 5).map(tick => ({
            position: (tick - paddedMin) / paddedRange,
            label: formatTickValue(tick),
        }));

        return {
            isNumeric: true,
            min: paddedMin,
            max: paddedMax,
            scale: (v: unknown) => {
                const num = typeof v === 'number' ? v : parseFloat(String(v));
                return (num - paddedMin) / paddedRange;
            },
            ticks,
        };
    } else {
        // Categorical axis
        const categories = [...new Set(values.map(v => String(v)))];
        const categoryCount = categories.length;

        // Position categories evenly with padding on edges
        const step = 1 / (categoryCount + 1);

        const ticks = categories.map((cat, i) => ({
            position: (i + 1) * step,
            label: cat,
        }));

        const categoryIndex = new Map(categories.map((cat, i) => [cat, i]));

        return {
            isNumeric: false,
            categories,
            scale: (v: unknown) => {
                const idx = categoryIndex.get(String(v)) ?? 0;
                return (idx + 1) * step;
            },
            ticks,
        };
    }
}

/**
 * Core render function for scatter chart.
 *
 * X and Y are dimensions (columns for positioning) - can be numeric or categorical.
 * Metric is the aggregated value shown as bubble size.
 */
function renderScatterChart(
    dataFrame: Table,
    theme: GlyphTheme | undefined,
    width: number | undefined,
    height: number | undefined,
    xAxis: Dimension,
    yAxis: Dimension,
    metric: Metric,
    palette?: Palette
): React.ReactNode {
    const currentTheme = theme || defaultTheme;
    const chartWidth = width || 600;
    const chartHeight = height || 400;
    const padding = { top: 20, right: 20, bottom: 60, left: 70 }; // More space for labels

    const xColumn = xAxis?.value;
    const yColumn = yAxis?.value;
    const metricColumn = metric?.value;

    const rows = dataFrame?.toArray() as DataRow[] || [];

    // Check if configured - need x, y dimensions and metric
    const isConfigured = xColumn && xColumn !== 'value' &&
                         yColumn && yColumn !== 'value' &&
                         metricColumn && metricColumn !== 'value';

    if (!isConfigured || rows.length === 0) {
        return null; // Let wrapper handle unconfigured state
    }

    // Extract raw values
    const xValues = rows.map(row => row[xColumn]);
    const yValues = rows.map(row => row[yColumn]);
    const sizeValues = rows.map(row => Number(row[metricColumn]) || 1);

    // Analyze axes
    const xAxisData = analyzeAxisData(xValues);
    const yAxisData = analyzeAxisData(yValues);

    // Size scale
    const sizeMin = Math.min(...sizeValues);
    const sizeMax = Math.max(...sizeValues);
    const scaleSize = (v: number) => {
        if (sizeMax === sizeMin) return 10;
        return 6 + ((v - sizeMin) / (sizeMax - sizeMin)) * 24;
    };

    // Plot dimensions
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // Scale to pixel coordinates
    const scaleX = (v: unknown) => padding.left + xAxisData.scale(v) * plotWidth;
    const scaleY = (v: unknown) => padding.top + plotHeight - yAxisData.scale(v) * plotHeight;

    // Extract data points
    const points = rows.map((row, i) => ({
        xRaw: row[xColumn],
        yRaw: row[yColumn],
        x: scaleX(row[xColumn]),
        y: scaleY(row[yColumn]),
        size: scaleSize(sizeValues[i] ?? 1),
        sizeRaw: sizeValues[i] ?? 1,
        index: i,
    }));

    return (
        <svg
            width={chartWidth}
            height={chartHeight}
            style={{ fontFamily: currentTheme.fontFamily }}
        >
            {/* Grid lines */}
            {yAxisData.ticks.map((tick, i) => (
                <line
                    key={`grid-y-${i}`}
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={padding.top + plotHeight - tick.position * plotHeight}
                    y2={padding.top + plotHeight - tick.position * plotHeight}
                    stroke={currentTheme.colors.gridLine}
                    strokeDasharray="2,2"
                />
            ))}
            {xAxisData.ticks.map((tick, i) => (
                <line
                    key={`grid-x-${i}`}
                    x1={padding.left + tick.position * plotWidth}
                    x2={padding.left + tick.position * plotWidth}
                    y1={padding.top}
                    y2={chartHeight - padding.bottom}
                    stroke={currentTheme.colors.gridLine}
                    strokeDasharray="2,2"
                />
            ))}

            {/* Axes */}
            <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={chartHeight - padding.bottom}
                y2={chartHeight - padding.bottom}
                stroke={currentTheme.colors.border}
            />
            <line
                x1={padding.left}
                x2={padding.left}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke={currentTheme.colors.border}
            />

            {/* X axis ticks and labels */}
            {xAxisData.ticks.map((tick, i) => {
                const xPos = padding.left + tick.position * plotWidth;
                const isCategorical = !xAxisData.isNumeric;
                return (
                    <g key={`x-tick-${i}`}>
                        <line
                            x1={xPos}
                            x2={xPos}
                            y1={chartHeight - padding.bottom}
                            y2={chartHeight - padding.bottom + 4}
                            stroke={currentTheme.colors.border}
                        />
                        <text
                            x={xPos}
                            y={chartHeight - padding.bottom + 16}
                            textAnchor={isCategorical ? 'end' : 'middle'}
                            fontSize="10"
                            fill={currentTheme.colors.text}
                            transform={isCategorical ? `rotate(-45, ${xPos}, ${chartHeight - padding.bottom + 16})` : undefined}
                        >
                            {tick.label.length > 12 ? tick.label.slice(0, 12) + '…' : tick.label}
                        </text>
                    </g>
                );
            })}

            {/* Y axis ticks and labels */}
            {yAxisData.ticks.map((tick, i) => {
                const yPos = padding.top + plotHeight - tick.position * plotHeight;
                return (
                    <g key={`y-tick-${i}`}>
                        <line
                            x1={padding.left - 4}
                            x2={padding.left}
                            y1={yPos}
                            y2={yPos}
                            stroke={currentTheme.colors.border}
                        />
                        <text
                            x={padding.left - 8}
                            y={yPos + 3}
                            textAnchor="end"
                            fontSize="10"
                            fill={currentTheme.colors.text}
                        >
                            {tick.label.length > 10 ? tick.label.slice(0, 10) + '…' : tick.label}
                        </text>
                    </g>
                );
            })}

            {/* Axis labels */}
            <text
                x={padding.left + plotWidth / 2}
                y={chartHeight - 5}
                textAnchor="middle"
                fontSize="12"
                fill={currentTheme.colors.text}
            >
                {xColumn}
            </text>
            <text
                x={12}
                y={padding.top + plotHeight / 2}
                textAnchor="middle"
                fontSize="12"
                fill={currentTheme.colors.text}
                transform={`rotate(-90, 12, ${padding.top + plotHeight / 2})`}
            >
                {yColumn}
            </text>

            {/* Data points */}
            {points.map((point, i) => (
                <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r={point.size}
                    fill={palette?.getColor(i) || '#1f77b4'}
                    fillOpacity={0.7}
                    stroke={palette?.getColor(i) || '#1f77b4'}
                    strokeWidth={1}
                >
                    <title>{`${xColumn}: ${point.xRaw}\n${yColumn}: ${point.yRaw}\n${metricColumn}: ${point.sizeRaw}`}</title>
                </circle>
            ))}
        </svg>
    );
}

/**
 * Generate nice tick values for an axis.
 */
function generateTicks(min: number, max: number, count: number): number[] {
    const range = max - min;
    const step = range / (count - 1);
    const ticks: number[] = [];
    for (let i = 0; i < count; i++) {
        ticks.push(min + step * i);
    }
    return ticks;
}

/**
 * Format tick value for display.
 */
function formatTickValue(value: number): string {
    if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
    }
    if (Number.isInteger(value)) {
        return value.toString();
    }
    return value.toFixed(1);
}

// Create base chart with explicit argument types
// (Override reflection fallbacks that misdetect xAxis/yAxis)
const BaseChart = createChart(
    'Glyph Scatter Chart',
    renderScatterChart,
    {
        description: 'A scatter/bubble chart with drag-and-drop configuration',
        category: 'Correlation',
        tags: ['scatter', 'bubble', 'correlation'],
        // Explicit argument types - xAxis and yAxis are Dimensions, metric is a Metric
        arguments: {
            xAxis: Dimension,
            yAxis: Dimension,
            metric: Metric,
        },
    }
);

interface DropTargetState {
    xAxis: string | null;
    yAxis: string | null;
    metric: string | null;
}

/**
 * Wrapper component with drag-and-drop support.
 */
function ScatterChartWithDnD(props: ChartProps & Record<string, unknown>): React.ReactNode {
    const {
        theme,
        width,
        height,
        hooks,
        xAxis,
        yAxis,
        metric,
    } = props as ChartProps & {
        xAxis?: Dimension;
        yAxis?: Dimension;
        metric?: Metric;
    };

    const currentTheme = (theme || defaultTheme) as GlyphTheme;
    const chartWidth = width || 600;
    const chartHeight = height || 400;

    // Track pending drops
    const [pending, setPending] = useState<DropTargetState>({
        xAxis: null,
        yAxis: null,
        metric: null,
    });

    // Check configuration status - handle undefined props defensively
    const xValue = xAxis?.value || '';
    const yValue = yAxis?.value || '';
    const metricValue = metric?.value || '';

    // A value is configured if it exists and is not the default placeholder
    const isXConfigured = Boolean(xValue && xValue !== 'value');
    const isYConfigured = Boolean(yValue && yValue !== 'value');
    const isMetricConfigured = Boolean(metricValue && metricValue !== 'value');
    const isFullyConfigured = isXConfigured && isYConfigured && isMetricConfigured;

    // Clear pending when actual values arrive
    useEffect(() => {
        if (isXConfigured) setPending(p => ({ ...p, xAxis: null }));
        if (isYConfigured) setPending(p => ({ ...p, yAxis: null }));
        if (isMetricConfigured) setPending(p => ({ ...p, metric: null }));
    }, [isXConfigured, isYConfigured, isMetricConfigured]);

    // Handle drops
    const handleDrop = (target: keyof DropTargetState, controlName: string) => (item: DragItem) => {
        const metadata = item.metadata as Record<string, unknown> | undefined;
        // For dimensions, use column_name; for metrics, use metric_name
        const name = (metadata?.column_name as string) || (metadata?.metric_name as string) || item.name;
        setPending(p => ({ ...p, [target]: name }));
        if (hooks?.setControlValue) {
            hooks.setControlValue(controlName, name);
        }
    };

    // Show drop zone configuration when not fully configured
    // Keep showing individual drop zones until ALL are configured
    if (!isFullyConfigured) {
        // Determine effective values (pending or configured)
        const effectiveX = pending.xAxis || (isXConfigured ? xValue : null);
        const effectiveY = pending.yAxis || (isYConfigured ? yValue : null);
        const effectiveMetric = pending.metric || (isMetricConfigured ? metricValue : null);

        return (
            <div style={{
                display: 'flex',
                height: chartHeight,
                width: chartWidth,
                padding: '16px',
                boxSizing: 'border-box',
                gap: '8px',
            }}>
                {/* Y Axis drop zone - left side, vertical */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '80px',
                    gap: '8px',
                }}>
                    {effectiveY ? (
                        <ConfiguredSlot
                            label="Y"
                            value={effectiveY}
                            theme={currentTheme}
                            vertical
                            pending={!!pending.yAxis}
                            style={{ flex: 1 }}
                        />
                    ) : (
                        <DropZone
                            acceptTypes={[DragItemType.Column]}
                            onDrop={handleDrop('yAxis', 'yAxis')}
                            label="Y Axis"
                            description="Drop a column"
                            theme={currentTheme}
                            style={{
                                flex: 1,
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)',
                            }}
                        />
                    )}
                </div>

                {/* Main area - right side */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}>
                    {/* Metric drop zone - main chart area (bubble size) */}
                    <div style={{ flex: 1 }}>
                        {effectiveMetric ? (
                            <ConfiguredSlot
                                label="Metric"
                                value={effectiveMetric}
                                theme={currentTheme}
                                style={{ height: '100%' }}
                                pending={!!pending.metric}
                            />
                        ) : (
                            <DropZone
                                acceptTypes={[DragItemType.Metric]}
                                onDrop={handleDrop('metric', 'metric')}
                                label="Metric"
                                description="Drop a metric (bubble size)"
                                theme={currentTheme}
                                style={{ height: '100%' }}
                            />
                        )}
                    </div>

                    {/* X Axis drop zone - bottom */}
                    <div style={{ height: '60px' }}>
                        {effectiveX ? (
                            <ConfiguredSlot
                                label="X"
                                value={effectiveX}
                                theme={currentTheme}
                                pending={!!pending.xAxis}
                            />
                        ) : (
                            <DropZone
                                acceptTypes={[DragItemType.Column]}
                                onDrop={handleDrop('xAxis', 'xAxis')}
                                label="X Axis"
                                description="Drop a column"
                                theme={currentTheme}
                                style={{ height: '100%' }}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Render the chart with drop overlays
    return (
        <ScatterChartWithDropOverlays
            {...props}
            currentTheme={currentTheme}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            hooks={hooks}
            handleDrop={handleDrop}
        />
    );
}

/**
 * Scatter chart with drop overlay zones for changing dimensions/metric.
 */
function ScatterChartWithDropOverlays({
    currentTheme,
    chartWidth,
    chartHeight,
    hooks,
    handleDrop,
    ...props
}: ChartProps & Record<string, unknown> & {
    currentTheme: GlyphTheme;
    chartWidth: number;
    chartHeight: number;
    hooks?: ChartHooks;
    handleDrop: (target: 'xAxis' | 'yAxis' | 'metric', controlName: string) => (item: DragItem) => void;
}): React.ReactNode {
    const columnAcceptTypes = ACCEPT_TYPE_MAP[DragItemType.Column];
    const metricAcceptTypes = ACCEPT_TYPE_MAP[DragItemType.Metric];

    // X axis drop target (bottom area) - accepts columns
    const [{ isOver: isOverX }, dropRefX] = useDrop<DragObjectWithType, void, { isOver: boolean }>({
        accept: columnAcceptTypes,
        drop: (item) => {
            const dragItem = convertToDragItem(item);
            if (dragItem) handleDrop('xAxis', 'xAxis')(dragItem);
        },
        collect: (monitor: DropTargetMonitor) => ({ isOver: monitor.isOver() }),
    });

    // Y axis drop target (left area) - accepts columns
    const [{ isOver: isOverY }, dropRefY] = useDrop<DragObjectWithType, void, { isOver: boolean }>({
        accept: columnAcceptTypes,
        drop: (item) => {
            const dragItem = convertToDragItem(item);
            if (dragItem) handleDrop('yAxis', 'yAxis')(dragItem);
        },
        collect: (monitor: DropTargetMonitor) => ({ isOver: monitor.isOver() }),
    });

    // Metric drop target (center area) - accepts metrics
    const [{ isOver: isOverMetric }, dropRefMetric] = useDrop<DragObjectWithType, void, { isOver: boolean }>({
        accept: metricAcceptTypes,
        drop: (item) => {
            const dragItem = convertToDragItem(item);
            if (dragItem) handleDrop('metric', 'metric')(dragItem);
        },
        collect: (monitor: DropTargetMonitor) => ({ isOver: monitor.isOver() }),
    });

    return (
        <div style={{
            position: 'relative',
            width: chartWidth,
            height: chartHeight,
        }}>
            {/* The actual chart */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <BaseChart {...props as any} width={chartWidth} height={chartHeight} />

            {/* X axis drop zone (bottom) */}
            <div
                ref={dropRefX}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 50,
                    right: 20,
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isOverX ? 'rgba(82, 196, 26, 0.2)' : 'transparent',
                    border: isOverX ? '2px dashed #52c41a' : '2px dashed transparent',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                }}
            >
                {isOverX && (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#52c41a' }}>
                        Drop for X Axis
                    </span>
                )}
            </div>

            {/* Y axis drop zone (left) */}
            <div
                ref={dropRefY}
                style={{
                    position: 'absolute',
                    top: 20,
                    bottom: 40,
                    left: 0,
                    width: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isOverY ? 'rgba(82, 196, 26, 0.2)' : 'transparent',
                    border: isOverY ? '2px dashed #52c41a' : '2px dashed transparent',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                }}
            >
                {isOverY && (
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#52c41a',
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                    }}>
                        Drop for Y Axis
                    </span>
                )}
            </div>

            {/* Metric drop zone (center) */}
            <div
                ref={dropRefMetric}
                style={{
                    position: 'absolute',
                    top: 20,
                    bottom: 40,
                    left: 50,
                    right: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isOverMetric ? 'rgba(82, 196, 26, 0.15)' : 'transparent',
                    border: isOverMetric ? '2px dashed #52c41a' : '2px dashed transparent',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    pointerEvents: isOverX || isOverY ? 'none' : 'auto',
                }}
            >
                {isOverMetric && !isOverX && !isOverY && (
                    <div style={{
                        padding: '8px 16px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#52c41a' }}>
                            Drop for Metric
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Display a configured slot.
 * Shows green immediately when a value is set (even if pending confirmation).
 */
function ConfiguredSlot({
    label,
    value,
    theme,
    vertical,
    style,
    pending,
}: {
    label: string;
    value: string;
    theme: GlyphTheme;
    vertical?: boolean;
    style?: React.CSSProperties;
    pending?: boolean;
}): React.ReactElement {
    // Always show green when we have a value - it's fulfilled from user's perspective
    const accentColor = '#52c41a';

    return (
        <div style={{
            padding: vertical ? '16px 8px' : '12px 16px',
            backgroundColor: pending ? 'rgba(82, 196, 26, 0.05)' : 'rgba(82, 196, 26, 0.1)',
            border: `2px solid ${accentColor}`,
            borderRadius: '8px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            ...(vertical ? {
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
            } : {}),
            ...style,
        }}>
            <div style={{
                fontSize: '11px',
                color: theme.colors.text,
                opacity: 0.6,
                marginBottom: '4px',
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: accentColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: vertical ? 'none' : '150px',
            }}>
                {value}
            </div>
            {pending && (
                <div style={{
                    fontSize: '10px',
                    color: theme.colors.text,
                    opacity: 0.5,
                    marginTop: '4px',
                }}>
                    click Update Chart
                </div>
            )}
        </div>
    );
}

// Export with metadata
export const ScatterChart = Object.assign(ScatterChartWithDnD, {
    metadata: BaseChart.metadata,
    chartArguments: BaseChart.chartArguments,
}) as GlyphChart;
