import 'reflect-metadata';
import { Table } from 'apache-arrow';
import { reflect, ReflectedClassRef } from 'typescript-rtti';
import { Argument, Metric, Dimension, Int, Color, ChartProps } from './types';

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
    chartArguments: Map<string, typeof Argument>;  // Renamed from 'arguments'
    renderFn: ChartRenderFn;
}

/**
 * Global registry of Argument classes by name.
 * This allows cross-module type resolution since RTTI registries are module-local.
 */
const ArgumentClassRegistry = new Map<string, typeof Argument>([
    ['Metric', Metric],
    ['Dimension', Dimension],
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
        console.log('[createChart] Reflected parameter names:', reflected.parameterNames);

        for (const paramName of reflected.parameterNames) {
            // Skip the dataFrame parameter
            if (paramName === 'dataFrame') continue;

            names.push(paramName);

            const param = reflected.getParameter(paramName);
            const paramType = param.type;

            console.log(`[createChart] Param ${paramName} type kind:`, paramType.kind);

            // Handle union types (e.g., Metric | undefined)
            const types = paramType.is('union') ? paramType.types : [paramType];

            let found = false;
            for (const type of types) {
                if (type.is('class')) {
                    const classRef = type as ReflectedClassRef<unknown>;
                    const cls = classRef.reflectedClass?.class;

                    console.log(`[createChart] Param ${paramName} class:`, cls?.name);

                    if (cls && (cls === Argument || cls.prototype instanceof Argument)) {
                        args.set(paramName, cls as typeof Argument);
                        console.log(`[createChart] Found argument (direct): ${paramName} -> ${cls.name}`);
                        found = true;
                        break;
                    }

                    // Try looking up by class name in registry
                    if (cls?.name && ArgumentClassRegistry.has(cls.name)) {
                        const registeredClass = ArgumentClassRegistry.get(cls.name)!;
                        args.set(paramName, registeredClass);
                        console.log(`[createChart] Found argument (registry): ${paramName} -> ${registeredClass.name}`);
                        found = true;
                        break;
                    }
                }

                // Try to get the type name from RTTI for registry lookup
                const typeName = (type as unknown as { name?: string }).name;
                if (typeName && ArgumentClassRegistry.has(typeName)) {
                    const registeredClass = ArgumentClassRegistry.get(typeName)!;
                    args.set(paramName, registeredClass);
                    console.log(`[createChart] Found argument (by name): ${paramName} -> ${registeredClass.name}`);
                    found = true;
                    break;
                }
            }

            // Fallback: Try to infer from parameter name (convention-based)
            if (!found) {
                // Check if parameter name matches a known argument class (case-insensitive)
                for (const [className, argClass] of ArgumentClassRegistry) {
                    if (paramName.toLowerCase().includes(className.toLowerCase())) {
                        args.set(paramName, argClass);
                        console.log(`[createChart] Found argument (by convention): ${paramName} -> ${argClass.name}`);
                        found = true;
                        break;
                    }
                }
            }

            // Additional fallback: common parameter name patterns
            if (!found) {
                const paramLower = paramName.toLowerCase();
                // Size/font size patterns -> Int
                if (paramLower.includes('size') || paramLower.includes('width') ||
                    paramLower.includes('height') || paramLower.includes('font')) {
                    args.set(paramName, Int);
                    console.log(`[createChart] Found argument (by pattern): ${paramName} -> Int`);
                    found = true;
                }
                // Color patterns
                else if (paramLower.includes('color') || paramLower.includes('colour') ||
                         paramLower.includes('fill') || paramLower.includes('stroke')) {
                    args.set(paramName, Color);
                    console.log(`[createChart] Found argument (by pattern): ${paramName} -> Color`);
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
     *
     * @example
     * ```typescript
     * const FontSize = Field(Int, { label: 'Font Size', min: 12, max: 200 });
     * type FontSize = Int;
     *
     * createChart('My Chart', renderFn, {
     *     arguments: { size: FontSize }
     * });
     * ```
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
            console.log(`[createChart] Override argument: ${paramName} -> ${argClass.name || 'CustomField'}`);
        }
    }

    console.log(`[createChart] ${name} - final arguments:`, Array.from(extractedArgs.keys()));

    // Create the React component as a plain object first, then add function behavior
    function ChartComponent(props: ChartProps & Record<string, Argument>) {
        const { dataFrame, ...argProps } = props;

        // Build argument array in parameter order (preserve order, don't filter)
        const argValues = parameterNames.map(paramName => argProps[paramName]);

        console.log('[ChartComponent] Rendering with args:', parameterNames, argValues);

        return renderFn(dataFrame, ...argValues);
    }

    // Create a wrapper object that acts as the chart
    const Chart = ChartComponent as unknown as GlyphChart;

    // Use Object.defineProperty to avoid strict mode issues with 'arguments'
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
