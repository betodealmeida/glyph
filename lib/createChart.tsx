import 'reflect-metadata';
import { Table } from 'apache-arrow';
import { reflect, ReflectedClassRef } from 'typescript-rtti';
import { Argument, Metric, Dimension, ChartProps } from './types';

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
        }
    } catch (e) {
        console.warn('[createChart] Reflection failed:', e);
    }

    return { names, args };
}

/**
 * Create a Glyph chart from a render function.
 */
export function createChart(
    name: string,
    renderFn: (dataFrame: Table, ...args: Argument[]) => React.ReactNode,
    options?: Partial<ChartMetadata>
): GlyphChart {
    // Extract arguments from metadata
    const { names: parameterNames, args: extractedArgs } = extractArgumentsFromMetadata(renderFn);

    console.log(`[createChart] ${name} - discovered arguments:`, Array.from(extractedArgs.keys()));

    // Create the React component as a plain object first, then add function behavior
    function ChartComponent(props: ChartProps & Record<string, Argument>) {
        const { dataFrame, ...argProps } = props;

        // Build argument array in parameter order
        const argValues: Argument[] = parameterNames
            .map(paramName => argProps[paramName])
            .filter((arg): arg is Argument => arg !== undefined);

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
