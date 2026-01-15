import "reflect-metadata";

// Re-export types
export type { ChartProps } from './types';
export { Argument, Metric, Dimension, ColumnType } from './types';

// Re-export chart creation
export { createChart, registerArgumentClass } from './createChart';
export type { GlyphChart, ChartMetadata, ChartRenderFn } from './createChart';

// Re-export Superset adapter
export {
    createSupersetPlugin,
    makeChartPlugin,
    getChartArguments,
} from './interfaces/superset';
export type {
    GlyphChartMetadata,
    SupersetChartProps,
    ControlPanelConfig,
    SupersetDeps,
    PluginOptions,
} from './interfaces/superset';

// Re-export charts
export { BigNumber } from './charts/BigNumber';
