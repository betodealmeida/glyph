import 'reflect-metadata';
import { Table } from 'apache-arrow';
import { reflect, ReflectedClassRef } from 'typescript-rtti';
import { Argument, Metric, Dimension, Temporal, Int, Color, ChartProps } from './types';

/**
 * Chart render function type.
 */
export type ChartRenderFn = (...args: Argument[]) => React.ReactNode;

/**
 * Metadata for a chart.
 */
export interface ChartMetadata {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
}

/**
 * Props type for Glyph charts - combines ChartProps with argument props.
 */
export type GlyphChartProps = ChartProps & { [key: string]: Argument | ChartProps['dataFrame'] };

/**
 * A Glyph chart created via createChart.
 */
export interface GlyphChart extends React.FC<GlyphChartProps> {
    metadata: ChartMetadata;
    chartArguments: Map<string, typeof Argument>;
    renderFn: ChartRenderFn;
}

/**
 * Global registry of Argument classes by name.
 * This allows cross-module type resolution since RTTI registries are module-local.
 */
const ArgumentClassRegistry = new Map<string, typeof Argument>([
    ['Metric', Metric],
    ['Dimension', Dimension],
    ['Temporal', Temporal],
    ['Int', Int],
    ['Color', Color],
    ['Argument', Argument],
]);

/**
 * Register a custom Argument class for reflection discovery.
 */
export function registerArgumentClass(cls: typeof Argument): void {
    ArgumentClassRegistry.set(cls.name, cls);
}

/**
 * Extract argument info using typescript-rtti's reflect() function.
 * Falls back to looking up classes by type name from the registry.
 */
function extractArgumentsFromMetadata(
    renderFn: Function
): { names: string[]; args: Map<string, typeof Argument> } {
    const args = new Map<string, typeof Argument>();
    const names: string[] = [];

    try {
        const reflected = reflect(renderFn);

        for (const paramName of reflected.parameterNames) {
            // Skip built-in parameters (handled separately)
            if (paramName === 'dataFrame' || paramName === 'theme' ||
                paramName === 'width' || paramName === 'height') continue;

            names.push(paramName);

            const param = reflected.getParameter(paramName);
            const paramType = param.type;

            // Handle union types (e.g., Metric | undefined)
            const types = paramType.is('union') ? paramType.types : [paramType];

            let found = false;
            for (const type of types) {
                if (type.is('class')) {
                    const classRef = type as ReflectedClassRef<unknown>;
                    const cls = classRef.reflectedClass?.class;

                    if (cls && (cls === Argument || cls.prototype instanceof Argument)) {
                        args.set(paramName, cls as typeof Argument);
                        found = true;
                        break;
                    }

                    // Try looking up by class name in registry
                    if (cls?.name && ArgumentClassRegistry.has(cls.name)) {
                        const registeredClass = ArgumentClassRegistry.get(cls.name)!;
                        args.set(paramName, registeredClass);
                        found = true;
                        break;
                    }
                }

                // Try to get the type name from RTTI for registry lookup
                const typeName = (type as unknown as { name?: string }).name;
                if (typeName && ArgumentClassRegistry.has(typeName)) {
                    const registeredClass = ArgumentClassRegistry.get(typeName)!;
                    args.set(paramName, registeredClass);
                    found = true;
                    break;
                }
            }

            // Fallback: Try to infer from parameter name (convention-based)
            if (!found) {
                for (const [className, argClass] of ArgumentClassRegistry) {
                    if (paramName.toLowerCase().includes(className.toLowerCase())) {
                        args.set(paramName, argClass);
                        found = true;
                        break;
                    }
                }
            }

            // Additional fallback: common parameter name patterns
            if (!found) {
                const paramLower = paramName.toLowerCase();
                // Temporal patterns -> Temporal
                if (paramLower.includes('time') || paramLower.includes('date') ||
                    paramLower.includes('temporal') || paramLower === 'x' || paramLower === 'xaxis') {
                    args.set(paramName, Temporal);
                    found = true;
                }
                // Metric patterns -> Metric
                else if (paramLower.includes('metric') || paramLower.includes('value') ||
                         paramLower.includes('measure') || paramLower === 'y' || paramLower === 'yaxis') {
                    args.set(paramName, Metric);
                    found = true;
                }
                // Dimension/groupby patterns -> Dimension
                else if (paramLower.includes('group') || paramLower.includes('dimension') ||
                         paramLower.includes('category') || paramLower.includes('series')) {
                    args.set(paramName, Dimension);
                    found = true;
                }
                // Size/font size patterns -> Int
                else if (paramLower.includes('size') || paramLower.includes('width') ||
                    paramLower.includes('height') || paramLower.includes('font')) {
                    args.set(paramName, Int);
                    found = true;
                }
                // Color patterns
                else if (paramLower.includes('color') || paramLower.includes('colour') ||
                         paramLower.includes('fill') || paramLower.includes('stroke')) {
                    args.set(paramName, Color);
                    found = true;
                }
            }
        }
    } catch (e) {
        console.warn('[createChart] Reflection failed:', e);
    }

    return { names, args };
}

/**
 * Extended options for createChart, including explicit argument overrides.
 */
export interface CreateChartOptions extends Partial<ChartMetadata> {
    /**
     * Explicit argument class mapping. Use this to specify custom Field() classes
     * that can't be discovered via reflection.
     */
    arguments?: Record<string, typeof Argument>;
}

/**
 * Create a Glyph chart from a render function.
 * The render function can accept any Argument subclasses (Metric, Int, Color, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createChart(
    name: string,
    renderFn: (dataFrame: Table, ...args: any[]) => React.ReactNode,
    options?: CreateChartOptions
): GlyphChart {
    // Extract arguments from metadata
    const { names: parameterNames, args: extractedArgs } = extractArgumentsFromMetadata(renderFn);

    // Merge explicit argument overrides
    if (options?.arguments) {
        for (const [paramName, argClass] of Object.entries(options.arguments)) {
            extractedArgs.set(paramName, argClass);
        }
    }

    // Create the React component
    function ChartComponent(props: ChartProps & Record<string, Argument>) {
        const { dataFrame, theme, width, height, ...argProps } = props;

        // Build argument array in parameter order
        const argValues = parameterNames.map(paramName => argProps[paramName]);

        // Pass theme, width, height as arguments after dataFrame
        return renderFn(dataFrame, theme, width, height, ...argValues);
    }

    // Create a wrapper object that acts as the chart
    const Chart = ChartComponent as unknown as GlyphChart;

    Object.defineProperty(Chart, 'metadata', {
        value: {
            name,
            description: options?.description || '',
            category: options?.category,
            tags: options?.tags,
        },
        writable: false,
        enumerable: true,
    });

    Object.defineProperty(Chart, 'chartArguments', {
        value: extractedArgs,
        writable: false,
        enumerable: true,
    });

    Object.defineProperty(Chart, 'renderFn', {
        value: renderFn,
        writable: false,
        enumerable: true,
    });

    return Chart;
}
