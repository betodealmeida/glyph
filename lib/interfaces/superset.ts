import "reflect-metadata";
import { reflect, ReflectedClassRef } from 'typescript-rtti';
import { Table, tableFromArrays } from 'apache-arrow';
import { Argument, Metric, Dimension, ColumnType, ChartProps } from '../types';

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
 * Glyph chart metadata.
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
 * A Glyph chart component with metadata.
 */
export type GlyphChart<P extends ChartProps = ChartProps> = React.FC<P> & {
    metadata?: GlyphChartMetadata;
};

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
    return COLUMN_TYPE_TO_CONTROL[types[0]] || 'TextControl';
}

/**
 * Extract chart arguments from metadata.
 */
export function getChartArguments(chart: GlyphChart): Map<string, typeof Argument> {
    const args = new Map<string, typeof Argument>();

    if (chart.metadata?.arguments) {
        for (const [name, argClass] of Object.entries(chart.metadata.arguments)) {
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
function generateTransformProps<P extends ChartProps>(
    chart: GlyphChart<P>
): (chartProps: SupersetChartProps) => P {
    const args = getChartArguments(chart);

    return (chartProps: SupersetChartProps): P => {
        const { formData, queriesData } = chartProps;
        const data = queriesData[0]?.data || [];

        // Convert to Apache Arrow Table
        const columns: Record<string, unknown[]> = {};
        if (data.length > 0) {
            for (const key of Object.keys(data[0])) {
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

        return props as P;
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
 * Create a Superset ChartPlugin class from a Glyph chart.
 *
 * Usage in Superset:
 * ```typescript
 * import { ChartPlugin, ChartMetadata } from '@superset-ui/core';
 * import { BigNumber, makeChartPlugin } from 'glyph';
 * import thumbnail from './thumbnail.png';
 *
 * export default makeChartPlugin(BigNumber, { ChartPlugin, ChartMetadata }, { thumbnail });
 * ```
 */
export function makeChartPlugin<P extends ChartProps>(
    chart: GlyphChart<P>,
    deps: SupersetDeps,
    options: PluginOptions
) {
    const { ChartPlugin, ChartMetadata } = deps;
    const meta = chart.metadata || { name: chart.name || 'Chart', description: '' };

    const metadata = new ChartMetadata({
        name: meta.name,
        description: meta.description,
        category: meta.category || 'Glyph',
        tags: meta.tags || ['Glyph'],
        thumbnail: options.thumbnail,
    });

    const controlPanel = generateControlPanel(chart);
    const transformProps = generateTransformProps(chart);

    return class GlyphChartPlugin extends (ChartPlugin as new (...args: unknown[]) => unknown) {
        constructor() {
            super({
                metadata,
                loadChart: () => Promise.resolve({ default: chart }),
                controlPanel,
                transformProps,
            });
        }
    };
}

// Legacy exports for backward compatibility
export { generateControlPanel, generateTransformProps };

export function createSupersetPlugin<P extends ChartProps>(chart: GlyphChart<P>) {
    const meta = chart.metadata || { name: chart.name || 'Chart', description: '' };

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
