import "reflect-metadata";

// Re-export types
export type { ChartProps, IntOptions, ColorOptions } from './types';
export { Argument, Metric, Dimension, Int, Color, ColumnType } from './types';

// Re-export chart creation
export { createChart, registerArgumentClass } from './createChart';
export type { GlyphChart, ChartMetadata, ChartRenderFn, CreateChartOptions } from './createChart';

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
export { FancyBigNumber } from './charts/FancyBigNumber';
