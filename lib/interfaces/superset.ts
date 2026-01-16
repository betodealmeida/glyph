import "reflect-metadata";
import { tableFromArrays } from 'apache-arrow';
import { Argument, ColumnType, Int, Color } from '../types';
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
 * RGBA color format used by Superset's ColorPickerControl.
 */
interface RgbaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * Convert hex color string to RGBA object for Superset's ColorPickerControl.
 */
function hexToRgba(hex: string): RgbaColor {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result && result[1] && result[2] && result[3]) {
        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
            a: 1,
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Convert RGBA object to hex color string.
 */
function rgbaToHex(rgba: RgbaColor): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
}

/**
 * Mapping from Glyph ColumnType to Superset control type.
 */
const COLUMN_TYPE_TO_CONTROL: Record<ColumnType, string> = {
    [ColumnType.Metric]: 'metric',
    [ColumnType.Dimension]: 'groupby',
    [ColumnType.Argument]: 'TextControl',
};

/**
 * Get the Superset control type for an argument class.
 * Special cases Int and Color for their specific controls.
 */
function getControlForArgument(argClass: typeof Argument): string {
    // Check for specific argument types first
    if (argClass === Int || argClass.prototype instanceof Int) {
        return 'SliderControl';
    }
    if (argClass === Color || argClass.prototype instanceof Color) {
        return 'ColorPickerControl';
    }

    // Fall back to column type mapping
    const types = argClass.types || [ColumnType.Argument];
    const firstType = types[0];
    return firstType ? COLUMN_TYPE_TO_CONTROL[firstType] || 'TextControl' : 'TextControl';
}

/**
 * Get control configuration for an argument class.
 */
function getControlConfig(argClass: typeof Argument, paramName: string): Record<string, unknown> {
    const label = argClass.label || paramName;
    const description = argClass.description || '';

    if (argClass === Int || argClass.prototype instanceof Int) {
        const intClass = argClass as typeof Int;
        return {
            type: 'SliderControl',
            label,
            description,
            default: intClass.default ?? 32,
            min: intClass.min ?? 8,
            max: intClass.max ?? 128,
            step: 1,
            renderTrigger: true,
        };
    }

    if (argClass === Color || argClass.prototype instanceof Color) {
        const colorClass = argClass as typeof Color;
        // Convert hex default to RGBA format for Superset's ColorPickerControl
        const hexDefault = colorClass.default ?? '#000000';
        const rgbaDefault = hexToRgba(hexDefault);
        return {
            type: 'ColorPickerControl',
            label,
            description,
            default: rgbaDefault,
            renderTrigger: true,
        };
    }

    return {
        type: 'TextControl',
        label,
        description,
        renderTrigger: true,
    };
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
    const customizeControls: (string | { name: string; config: Record<string, unknown> })[][] = [];

    for (const [paramName, argClass] of args) {
        const control = getControlForArgument(argClass);

        if (control === 'metric' || control === 'groupby') {
            // Data controls go in Query section
            queryControls.push([control]);
        } else {
            // Style controls (Int, Color, etc.) go in Customize section
            customizeControls.push([{
                name: paramName,
                config: getControlConfig(argClass, paramName),
            }]);
        }
    }

    queryControls.push(['adhoc_filters']);

    const sections: ControlPanelConfig['controlPanelSections'] = [
        {
            label: 'Query',
            expanded: true,
            controlSetRows: queryControls,
        },
    ];

    if (customizeControls.length > 0) {
        sections.push({
            label: 'Customize',
            expanded: true,
            controlSetRows: customizeControls,
        });
    }

    return { controlPanelSections: sections };
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
            } else if (control === 'SliderControl') {
                // Int control - get value from formData
                const value = formData[name] ?? (argClass as typeof Int).default ?? 32;
                props[name] = new (argClass as typeof Int)(value as string | number);
            } else if (control === 'ColorPickerControl') {
                // Color control - get value from formData
                const colorClass = argClass as typeof Color;
                const defaultRgba = hexToRgba(colorClass.default ?? '#000000');
                const value = formData[name] ?? defaultRgba;
                // Handle Superset's RGBA color format { r, g, b, a }
                let colorValue: string;
                if (typeof value === 'object' && value !== null && 'r' in value) {
                    colorValue = rgbaToHex(value as RgbaColor);
                } else if (typeof value === 'string') {
                    colorValue = value;
                } else {
                    colorValue = '#000000';
                }
                props[name] = new argClass(colorValue);
            } else {
                // Generic argument - try to get from formData
                const value = formData[name];
                if (value !== undefined) {
                    props[name] = new argClass(String(value));
                }
            }
        }

        return props;
    };
}

/**
 * Superset dependencies passed to makeChartPlugin.
 * These come from @superset-ui/core in Superset.
 *
 * Note: We use `any` for constructor args because Superset's ChartPlugin
 * has complex generics that can't be easily expressed without importing
 * Superset's types directly.
 */
export interface SupersetDeps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ChartPlugin: abstract new (...args: any[]) => {
        configure(options: { key: string }): unknown;
    };
    ChartMetadata: new (config: {
        name: string;
        description?: string;
        category?: string;
        tags?: string[];
        thumbnail: string;
    }) => unknown;
    // Optional: buildQueryContext for proper query generation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildQueryContext?: (formData: any, buildQuery: (baseQuery: any) => any[]) => any;
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
 * Get parameter names that are visualization-only (should not be sent to backend).
 * These are Int, Color, and other non-data arguments.
 */
function getVisualizationOnlyParams(chart: GlyphChart): Set<string> {
    const args = getChartArguments(chart);
    const vizOnlyParams = new Set<string>();

    for (const [paramName, argClass] of args) {
        const control = getControlForArgument(argClass);
        // SliderControl (Int) and ColorPickerControl (Color) are visualization-only
        if (control === 'SliderControl' || control === 'ColorPickerControl' || control === 'TextControl') {
            vizOnlyParams.add(paramName);
        }
    }

    return vizOnlyParams;
}

/**
 * Generate a buildQuery function that filters out visualization-only controls.
 */
function generateBuildQuery(
    chart: GlyphChart,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildQueryContext: (formData: any, buildQuery: (baseQuery: any) => any[]) => any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): (formData: any) => any {
    const vizOnlyParams = getVisualizationOnlyParams(chart);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (formData: any) => {
        // Clean formData by removing visualization-only params before building query
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanedFormData: Record<string, any> = { ...formData };

        // Remove visualization-only params from formData
        for (const param of vizOnlyParams) {
            delete cleanedFormData[param];
        }

        // Also filter metrics array if it contains non-metric values
        if (Array.isArray(cleanedFormData.metrics)) {
            cleanedFormData.metrics = cleanedFormData.metrics.filter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (m: any) => typeof m === 'string' || (typeof m === 'object' && m !== null && 'label' in m)
            );
        }

        return buildQueryContext(cleanedFormData, baseQueryObject => [
            {
                ...baseQueryObject,
            },
        ]);
    };
}

/**
 * Create a Superset ChartPlugin class from a Glyph chart.
 *
 * Usage in Superset:
 * ```typescript
 * import { ChartPlugin, ChartMetadata, buildQueryContext } from '@superset-ui/core';
 * import { BigNumberPure, makeChartPlugin } from 'glyph';
 * import thumbnail from './thumbnail.png';
 *
 * export default makeChartPlugin(BigNumberPure, { ChartPlugin, ChartMetadata, buildQueryContext }, { thumbnail });
 * ```
 */
export function makeChartPlugin(
    chart: GlyphChart,
    deps: SupersetDeps,
    options: PluginOptions
) {
    const { ChartPlugin, ChartMetadata: SupersetChartMetadata, buildQueryContext } = deps;
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
    const pluginConfig: Record<string, any> = {
        metadata,
        loadChart: () => Promise.resolve({ default: chart as React.FC<unknown> }),
        controlPanel,
        transformProps,
    };

    // Add buildQuery if buildQueryContext is provided
    if (buildQueryContext) {
        pluginConfig.buildQuery = generateBuildQuery(chart, buildQueryContext);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BasePlugin = ChartPlugin as new (config: any) => any;

    return class GlyphChartPlugin extends BasePlugin {
        constructor() {
            super(pluginConfig);
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
