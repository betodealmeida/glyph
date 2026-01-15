import "reflect-metadata";
import { reflect, ReflectedClassRef } from 'typescript-rtti';

// Re-export types (separate type-only exports for interfaces)
export type { ChartProps } from './types';
export { Argument, Metric, Dimension, ColumnType } from './types';

// Re-export Superset adapter
export {
    createSupersetPlugin,
    makeChartPlugin,
    getChartArguments,
} from './interfaces/superset';
export type {
    GlyphChart,
    GlyphChartMetadata,
    SupersetChartProps,
    ControlPanelConfig,
    SupersetDeps,
    PluginOptions,
} from './interfaces/superset';

// Re-export charts
export { BigNumber } from './charts/BigNumber';

export function getArguments(chart: React.FC<unknown>): Record<string, unknown[]> {
    /*
     * Return the arguments needed for a given function.
     */
    const reflected = reflect(chart);

    return Object.fromEntries(
        reflect(chart).parameterNames.map((name) => {
            const argument = reflected.getParameter(name);
            const types = argument.type.is('union') ? argument.type.types : [argument.type];
            return [name, types.map((type: ReflectedClassRef<unknown>) => type?.reflectedClass?.class)];
        })
    );
}
