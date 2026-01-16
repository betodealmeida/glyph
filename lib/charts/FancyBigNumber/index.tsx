import { useState, useEffect } from 'react';
import { useDrop, DragObjectWithType, DropTargetMonitor } from 'react-dnd';
import { Table } from 'apache-arrow';
import { Metric, Int, Color, GlyphTheme, DragItem, DragItemType, defaultTheme, ChartProps, DataRow } from '../../types';
import { createChart, GlyphChart } from '../../createChart';
import { DropZone, ACCEPT_TYPE_MAP, convertToDragItem } from '../../components/DropZone';

// Define custom types - clean and simple!
class FontSize extends Int.with({ label: 'Font Size', min: 12, max: 200, default: 48 }) {}
class FontColor extends Color.with({ label: 'Font Color', default: '#1f77b4' }) {}
class Precision extends Int.with({ label: 'Decimal Places', min: 0, max: 10, default: 2 }) {}

/**
 * Format a number with specified precision.
 */
function formatNumber(value: unknown, precision: number): string {
    if (typeof value === 'number') {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: precision
        });
    }
    if (typeof value === 'string') return value;
    return 'N/A';
}

/**
 * Core render function - createChart will reflect on this to extract argument types.
 */
function renderFancyBigNumber(
    dataFrame: Table,
    metric: Metric,
    size: FontSize,
    color: FontColor,
    precision: Precision
): React.ReactNode {
    const fontSize = size?.numericValue ?? 48;
    const fontColor = color?.value || '#1f77b4';
    const decimalPlaces = precision?.numericValue ?? 2;
    const values = dataFrame?.toArray() as DataRow[] || [];
    const metricColumn = metric?.value || 'value';

    // If no data, show N/A
    if (values.length === 0) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
            }}>
                <h1 style={{
                    fontSize: `${fontSize}px`,
                    color: fontColor,
                    margin: 0,
                    fontWeight: 'bold',
                    opacity: 0.5,
                }}>
                    N/A
                </h1>
            </div>
        );
    }

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
                        {formatNumber(row[metricColumn], decimalPlaces)}
                    </h1>
                </div>
            ))}
        </div>
    );
}

// Create base chart with reflection-based metadata extraction
const BaseChart = createChart(
    'Glyph Fancy Big Number',
    renderFancyBigNumber,
    { description: 'A Big Number with customizable font size and color' }
);

/**
 * Stateful wrapper that adds drag-and-drop support.
 * This wraps the base chart to add pending-drop state tracking.
 */
function FancyBigNumberWithDnD(props: ChartProps & Record<string, unknown>): React.ReactNode {
    const { theme, width, height, hooks, metric } = props as ChartProps & { metric?: Metric };
    const currentTheme = (theme || defaultTheme) as GlyphTheme;

    // Track pending metric drop (before "Update chart" is clicked)
    const [pendingMetric, setPendingMetric] = useState<string | null>(null);

    // Check if metric is configured from formData
    const metricValue = metric?.value;
    const isMetricConfigured = metricValue && metricValue !== 'value' && metricValue !== '';

    // Clear pending metric when actual metric arrives
    useEffect(() => {
        if (isMetricConfigured) {
            setPendingMetric(null);
        }
    }, [isMetricConfigured]);

    // Handle metric drop
    const handleMetricDrop = (item: DragItem) => {
        const metadata = item.metadata as Record<string, unknown> | undefined;
        const metricName = (metadata?.metric_name as string) || item.name;

        // Track pending metric for immediate UI feedback
        setPendingMetric(metricName);

        // Update the Superset control
        if (hooks?.setControlValue) {
            hooks.setControlValue('metric', metricName);
        }
    };

    // Set up drop target for the entire chart (for changing metric on rendered chart)
    const acceptTypes = ACCEPT_TYPE_MAP[DragItemType.Metric];
    const [{ isOver, canDrop }, dropRef] = useDrop<DragObjectWithType, void, { isOver: boolean; canDrop: boolean }>({
        accept: acceptTypes,
        drop: (item: DragObjectWithType) => {
            const dragItem = convertToDragItem(item);
            if (dragItem) {
                handleMetricDrop(dragItem);
            }
        },
        collect: (monitor: DropTargetMonitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    const showDropOverlay = isOver && canDrop;

    // Show drop zone when metric is not configured (and no pending drop)
    if (!isMetricConfigured && !pendingMetric) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: height || '100%',
                width: width || '100%',
                padding: '20px',
                boxSizing: 'border-box',
            }}>
                <DropZone
                    acceptTypes={[DragItemType.Metric]}
                    onDrop={handleMetricDrop}
                    label="Drop a metric here"
                    description="Drag a metric from the data panel"
                    theme={currentTheme}
                    style={{
                        width: '100%',
                        maxWidth: '300px',
                        minHeight: '120px',
                    }}
                />
            </div>
        );
    }

    // Show "pending" state when metric was dropped but chart hasn't updated yet
    if (pendingMetric && !isMetricConfigured) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: height || '100%',
                width: width || '100%',
                padding: '20px',
                boxSizing: 'border-box',
                gap: '12px',
            }}>
                <div style={{
                    padding: '16px 24px',
                    backgroundColor: currentTheme.colors.background,
                    border: `2px solid ${currentTheme.colors.border}`,
                    borderRadius: '8px',
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: currentTheme.colors.text,
                        marginBottom: '4px',
                    }}>
                        {pendingMetric}
                    </div>
                    <div style={{
                        fontSize: '12px',
                        color: currentTheme.colors.text,
                        opacity: 0.6,
                    }}>
                        Click "Update chart" to load data
                    </div>
                </div>
            </div>
        );
    }

    // Render the base chart with data, wrapped in a drop target
    return (
        <div
            ref={dropRef}
            style={{
                position: 'relative',
                width: width || '100%',
                height: height || '100%',
            }}
        >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <BaseChart {...props as any} />

            {/* Drop overlay - shown when dragging a metric over the chart */}
            {showDropOverlay && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(82, 196, 26, 0.15)',
                    border: '2px dashed #52c41a',
                    borderRadius: '8px',
                    zIndex: 10,
                }}>
                    <div style={{
                        padding: '16px 24px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#52c41a',
                        }}>
                            Drop to change metric
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Export with metadata from the base chart (preserves reflection-extracted types)
export const FancyBigNumber = Object.assign(FancyBigNumberWithDnD, {
    metadata: BaseChart.metadata,
    chartArguments: BaseChart.chartArguments,
}) as GlyphChart;
