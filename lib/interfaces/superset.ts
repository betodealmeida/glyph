import "reflect-metadata";
import { reflect, ReflectedClassRef } from 'typescript-rtti';
import { Table, tableFromArrays } from 'apache-arrow';
import { Argument, Metric, Dimension, ColumnType, ChartProps } from '../types';

/**
 * Superset plugin interfaces (simplified from @superset-ui/core)
 * These match Superset's expected types for chart plugins.
 */

export interface QueryFormData {
    [key: string]: unknown;
    metric?: string | { label: string };
    metrics?: (string | { label: string })[];
    groupby?: string[];
    columns?: string[];
}

export interface ChartDataResponseResult {
    data: Record<string, unknown>[];
}

export interface SupersetChartProps {
    width: number;
    height: number;
    formData: QueryFormData;
    queriesData: ChartDataResponseResult[];
}

export interface ControlConfig {
    name: string;
    config: {
        type: string;
        label: string;
        description?: string;
        default?: unknown;
        renderTrigger?: boolean;
        [key: string]: unknown;
    };
}

export interface ControlPanelSection {
    label: string;
    expanded: boolean;
    controlSetRows: (string | ControlConfig)[][];
}

export interface ControlPanelConfig {
    controlPanelSections: ControlPanelSection[];
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
 * Get the Superset control name for a given Argument class.
 */
function getControlForArgument(argClass: typeof Argument): string {
    const types = argClass.types || [ColumnType.Argument];
    // Use the first type to determine the control
    return COLUMN_TYPE_TO_CONTROL[types[0]] || 'TextControl';
}

/**
 * Metadata attached to Glyph chart components.
 */
export interface GlyphChartMetadata {
    name: string;
    description: string;
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
 * Extract chart arguments from metadata or via reflection.
 * Returns a map of parameter name -> argument class.
 */
export function getChartArguments(
    chart: GlyphChart
): Map<string, typeof Argument> {
    const args = new Map<string, typeof Argument>();

    // Prefer explicit metadata.arguments declaration
    if (chart.metadata?.arguments) {
        for (const [name, argClass] of Object.entries(chart.metadata.arguments)) {
            args.set(name, argClass);
        }
        return args;
    }

    // Fallback to reflection (may not work for destructured React props)
    const reflected = reflect(chart);

    for (const name of reflected.parameterNames) {
        if (name === 'dataFrame') continue; // Skip the data prop

        const param = reflected.getParameter(name);
        const type = param.type.is('union') ? param.type.types[0] : param.type;
        const argClass = (type as ReflectedClassRef<unknown>)?.reflectedClass?.class;

        if (argClass && (argClass === Argument || argClass.prototype instanceof Argument)) {
            args.set(name, argClass as typeof Argument);
        }
    }

    return args;
}

/**
 * Generate a Superset controlPanel config from a Glyph chart.
 */
export function generateControlPanel(chart: GlyphChart): ControlPanelConfig {
    const args = getChartArguments(chart);
    const queryControls: (string | ControlConfig)[][] = [];
    const chartOptions: (string | ControlConfig)[][] = [];

    for (const [name, argClass] of args) {
        const control = getControlForArgument(argClass);
        const label = argClass.label || name;
        const description = argClass.description || undefined;

        // Metric and dimension controls go in Query section
        if (control === 'metric' || control === 'groupby') {
            queryControls.push([control]);
        } else {
            // Other controls go in Chart Options
            chartOptions.push([{
                name,
                config: {
                    type: control,
                    label,
                    description,
                    renderTrigger: true,
                },
            }]);
        }
    }

    // Always include adhoc_filters for filtering
    queryControls.push(['adhoc_filters']);

    const sections: ControlPanelSection[] = [
        {
            label: 'Query',
            expanded: true,
            controlSetRows: queryControls,
        },
    ];

    if (chartOptions.length > 0) {
        sections.push({
            label: 'Chart Options',
            expanded: true,
            controlSetRows: chartOptions,
        });
    }

    return { controlPanelSections: sections };
}

/**
 * Generate a transformProps function for a Glyph chart.
 * This converts Superset's chartProps to the Glyph component's props.
 */
export function generateTransformProps<P extends ChartProps>(
    chart: GlyphChart<P>
): (chartProps: SupersetChartProps) => P {
    const args = getChartArguments(chart);

    return (chartProps: SupersetChartProps): P => {
        const { formData, queriesData } = chartProps;
        const data = queriesData[0]?.data || [];

        // Convert Superset data to Apache Arrow Table
        const columns: Record<string, unknown[]> = {};
        if (data.length > 0) {
            for (const key of Object.keys(data[0])) {
                columns[key] = data.map(row => row[key]);
            }
        }
        const dataFrame = tableFromArrays(columns);

        // Build props object
        const props: Record<string, unknown> = { dataFrame };

        for (const [name, argClass] of args) {
            const control = getControlForArgument(argClass);

            if (control === 'metric') {
                // Get metric label from formData
                const metricValue = formData.metric;
                const metricLabel = typeof metricValue === 'string'
                    ? metricValue
                    : metricValue?.label || 'value';
                props[name] = new argClass(metricLabel);
            } else if (control === 'groupby') {
                // Get first groupby column
                const groupby = formData.groupby || formData.columns || [];
                const dimValue = groupby[0] || '';
                props[name] = new argClass(dimValue);
            } else {
                // Other arguments come directly from formData
                const value = formData[name];
                if (value !== undefined) {
                    props[name] = new argClass(String(value));
                }
            }
        }

        return props as P;
    };
}

/**
 * Generate a buildQuery function (usually trivial for simple charts).
 */
export function generateBuildQuery() {
    return (formData: QueryFormData) => {
        // Return a minimal query context structure
        return {
            formData,
            queries: [{ ...formData }],
        };
    };
}

/**
 * Create a Superset plugin definition from a Glyph chart.
 * This returns all the pieces needed to register with Superset.
 */
export function createSupersetPlugin<P extends ChartProps>(chart: GlyphChart<P>) {
    const metadata = chart.metadata || {
        name: chart.name || 'Unknown Chart',
        description: 'A Glyph chart',
    };

    return {
        metadata: {
            name: metadata.name,
            description: metadata.description,
            category: 'Glyph',
            tags: ['Glyph'],
        },
        Chart: chart,
        controlPanel: generateControlPanel(chart),
        transformProps: generateTransformProps(chart),
        buildQuery: generateBuildQuery(),
    };
}
