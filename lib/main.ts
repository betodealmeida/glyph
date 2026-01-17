import "reflect-metadata";

// Re-export types
export type { ChartProps, IntOptions, ColorOptions, TemporalOptions, PaletteOptions, GlyphTheme, ChartHooks, DragItem } from './types';
export { Argument, Metric, Dimension, Temporal, Int, Color, Palette, DEFAULT_PALETTE, ColumnType, DragItemType, defaultTheme } from './types';

// Re-export components
export { DropZone } from './components';
export type { DropZoneProps } from './components';

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
export { LineChart } from './charts/LineChart';
export { ScatterChart } from './charts/ScatterChart';
