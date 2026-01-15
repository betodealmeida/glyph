import "reflect-metadata";
import { tableFromArrays } from 'apache-arrow';
import { Argument, ColumnType } from '../types';
import { GlyphChart as CreateChartGlyphChart } from '../createChart';

/**
 * Superset type interfaces (compatible with @superset-ui/core)
 */

export interface QueryFormData {
    [key: string]: unknown;
    metric?: string | { label: string };
    metrics?: (string | { label: string })[];
    groupby?: string[];
    columns?: string[];
}

export interface SupersetChartProps {
    width: number;
    height: number;
    formData: QueryFormData;
    queriesData: { data: Record<string, unknown>[] }[];
}

export interface ControlPanelConfig {
    controlPanelSections: {
        label: string;
        expanded: boolean;
        controlSetRows: (string | { name: string; config: Record<string, unknown> })[][];
    }[];
}

/**
 * Glyph chart metadata (legacy format).
 */
export interface GlyphChartMetadata {
    name: string;
    description: string;
    category?: string;
    tags?: string[];
    author?: { name: string; email: string };
    arguments?: Record<string, typeof Argument>;
}

/**
 * A Glyph chart component - supports both createChart and legacy formats.
 */
export type GlyphChart =
    | CreateChartGlyphChart  // New format from createChart()
    | (React.FC<unknown> & {
        metadata?: GlyphChartMetadata;
        chartArguments?: Map<string, typeof Argument>;
    });

/**
 * Mapping from Glyph ColumnType to Superset control type.
 */
const COLUMN_TYPE_TO_CONTROL: Record<ColumnType, string> = {
    [ColumnType.Metric]: 'metric',
    [ColumnType.Dimension]: 'groupby',
    [ColumnType.Argument]: 'TextControl',
};

function getControlForArgument(argClass: typeof Argument): string {
    const types = argClass.types || [ColumnType.Argument];
    const firstType = types[0];
    return firstType ? COLUMN_TYPE_TO_CONTROL[firstType] || 'TextControl' : 'TextControl';
}

/**
 * Extract chart arguments from a Glyph chart.
 * Supports both createChart format (chartArguments) and legacy format (metadata.arguments).
 */
export function getChartArguments(chart: GlyphChart): Map<string, typeof Argument> {
    // Check for createChart format first (has chartArguments from reflection)
    if ('chartArguments' in chart && chart.chartArguments instanceof Map) {
        console.log('[getChartArguments] Using chartArguments from createChart');
        return chart.chartArguments;
    }

    // Fall back to legacy metadata format
    const args = new Map<string, typeof Argument>();
    const legacyChart = chart as React.FC<unknown> & { metadata?: GlyphChartMetadata };

    if (legacyChart.metadata?.arguments) {
        console.log('[getChartArguments] Using legacy metadata.arguments');
        for (const [name, argClass] of Object.entries(legacyChart.metadata.arguments)) {
            args.set(name, argClass);
        }
    }

    return args;
}

/**
 * Generate Superset controlPanel from a Glyph chart.
 */
function generateControlPanel(chart: GlyphChart): ControlPanelConfig {
    const args = getChartArguments(chart);
    const queryControls: (string | { name: string; config: Record<string, unknown> })[][] = [];

    for (const [, argClass] of args) {
        const control = getControlForArgument(argClass);
        if (control === 'metric' || control === 'groupby') {
            queryControls.push([control]);
        }
    }

    queryControls.push(['adhoc_filters']);

    return {
        controlPanelSections: [{
            label: 'Query',
            expanded: true,
            controlSetRows: queryControls,
        }],
    };
}

/**
 * Generate transformProps function for a Glyph chart.
 */
function generateTransformProps(
    chart: GlyphChart
): (chartProps: SupersetChartProps) => Record<string, unknown> {
    const args = getChartArguments(chart);

    return (chartProps: SupersetChartProps) => {
        const { formData, queriesData } = chartProps;
        const data = queriesData[0]?.data || [];

        // Convert to Apache Arrow Table
        const columns: Record<string, unknown[]> = {};
        const firstRow = data[0];
        if (firstRow) {
            for (const key of Object.keys(firstRow)) {
                columns[key] = data.map(row => row[key]);
            }
        }
        const dataFrame = tableFromArrays(columns);

        // Build props
        const props: Record<string, unknown> = { dataFrame };

        for (const [name, argClass] of args) {
            const control = getControlForArgument(argClass);

            if (control === 'metric') {
                const metricValue = formData.metric;
                const metricLabel = typeof metricValue === 'string'
                    ? metricValue
                    : metricValue?.label || 'value';
                props[name] = new argClass(metricLabel);
            } else if (control === 'groupby') {
                const groupby = formData.groupby || formData.columns || [];
                props[name] = new argClass(groupby[0] || '');
            }
        }

        return props;
    };
}

/**
 * Superset dependencies passed to makeChartPlugin.
 * These come from @superset-ui/core in Superset.
 */
export interface SupersetDeps {
    ChartPlugin: new (config: {
        metadata: unknown;
        loadChart: () => Promise<{ default: React.FC<unknown> }>;
        controlPanel: ControlPanelConfig;
        transformProps: (props: SupersetChartProps) => unknown;
    }) => unknown;
    ChartMetadata: new (config: {
        name: string;
        description?: string;
        category?: string;
        tags?: string[];
        thumbnail: string;
    }) => unknown;
}

export interface PluginOptions {
    thumbnail: string;
    key?: string;
}

/**
 * Get chart metadata from either createChart or legacy format.
 */
function getChartMetadata(chart: GlyphChart): { name: string; description: string; category?: string; tags?: string[] } {
    // createChart format
    if ('metadata' in chart && chart.metadata && 'name' in chart.metadata) {
        return {
            name: chart.metadata.name,
            description: chart.metadata.description || '',
            category: chart.metadata.category,
            tags: chart.metadata.tags,
        };
    }

    // Legacy format or function name fallback
    const legacyChart = chart as React.FC<unknown> & { metadata?: GlyphChartMetadata };
    if (legacyChart.metadata) {
        return legacyChart.metadata;
    }

    return { name: chart.name || 'Chart', description: '' };
}

/**
 * Create a Superset ChartPlugin class from a Glyph chart.
 *
 * Usage in Superset:
 * ```typescript
 * import { ChartPlugin, ChartMetadata } from '@superset-ui/core';
 * import { BigNumberPure, makeChartPlugin } from 'glyph';
 * import thumbnail from './thumbnail.png';
 *
 * export default makeChartPlugin(BigNumberPure, { ChartPlugin, ChartMetadata }, { thumbnail });
 * ```
 */
export function makeChartPlugin(
    chart: GlyphChart,
    deps: SupersetDeps,
    options: PluginOptions
) {
    const { ChartPlugin, ChartMetadata: SupersetChartMetadata } = deps;
    const meta = getChartMetadata(chart);

    const metadata = new SupersetChartMetadata({
        name: meta.name,
        description: meta.description,
        category: meta.category || 'Glyph',
        tags: meta.tags || ['Glyph'],
        thumbnail: options.thumbnail,
    });

    const controlPanel = generateControlPanel(chart);
    const transformProps = generateTransformProps(chart);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BasePlugin = ChartPlugin as new (config: any) => any;

    return class GlyphChartPlugin extends BasePlugin {
        constructor() {
            super({
                metadata,
                loadChart: () => Promise.resolve({ default: chart as React.FC<unknown> }),
                controlPanel,
                transformProps,
            });
        }
    };
}

// Legacy exports for backward compatibility
export { generateControlPanel, generateTransformProps };

export function createSupersetPlugin(chart: GlyphChart) {
    const meta = getChartMetadata(chart);

    return {
        metadata: {
            name: meta.name,
            description: meta.description,
            category: meta.category || 'Glyph',
            tags: meta.tags || ['Glyph'],
        },
        Chart: chart,
        controlPanel: generateControlPanel(chart),
        transformProps: generateTransformProps(chart),
    };
}
