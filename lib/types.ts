import { Table } from 'apache-arrow';

/**
 * Theme interface for Glyph charts.
 * Maps to Superset's theme properties.
 */
export interface GlyphTheme {
    colors: {
        text: string;
        background: string;
        border: string;
        gridLine: string;
    };
    fontFamily: string;
}

/**
 * Default theme (light mode).
 */
export const defaultTheme: GlyphTheme = {
    colors: {
        text: '#333333',
        background: '#ffffff',
        border: '#cccccc',
        gridLine: '#e0e0e0',
    },
    fontFamily: 'system-ui, -apple-system, sans-serif',
};

/*
 * Base interface for all chart components.
 */
export interface ChartProps {
    dataFrame: Table;
    theme?: GlyphTheme;
    width?: number;
    height?: number;
}

export enum ColumnType {
    Metric = 'metric',
    Dimension = 'dimension',
    Temporal = 'temporal',
    Argument = 'argument',
}

export class Argument {

    static types: ColumnType[] = [ColumnType.Argument];

    static label: string | null = null;
    static description: string | null = null;

    value: string;

    constructor(value: string) {
        this.value = value;
    }
}

export class Metric extends Argument {
    static override types: ColumnType[] = [ColumnType.Metric];
    static override label = 'Metric';
    static override description = 'A numeric aggregation (SUM, COUNT, AVG, etc.)';
}

export class Dimension extends Argument {
    static override types: ColumnType[] = [ColumnType.Dimension];
    static override label = 'Dimension';
    static override description = 'A categorical column for grouping data';

    /**
     * Create a configured Dimension type.
     */
    static with(options: { label?: string; description?: string }): typeof Dimension {
        const Base = this;
        return class extends Base {
            static override label = options.label ?? Base.label;
            static override description = options.description ?? Base.description;
        };
    }
}

export interface TemporalOptions {
    label?: string;
    description?: string;
}

export class Temporal extends Argument {
    static override types: ColumnType[] = [ColumnType.Temporal];
    static override label: string | null = 'Time Column';
    static override description: string | null = 'A temporal column for time series data';

    constructor(value: string) {
        super(value);
    }

    /**
     * Create a configured Temporal type.
     * @example
     * ```typescript
     * class TimeAxis extends Temporal.with({ label: 'Time' }) {}
     * ```
     */
    static with(options: TemporalOptions): typeof Temporal {
        const Base = this;
        return class extends Base {
            static override label = options.label ?? Base.label;
            static override description = options.description ?? Base.description;
        };
    }
}

/**
 * Style/visual argument types - these generate UI controls in Superset
 */

export interface IntOptions {
    label?: string;
    description?: string;
    default?: number;
    min?: number;
    max?: number;
}

export class Int extends Argument {
    static override types: ColumnType[] = [ColumnType.Argument];
    static override label: string | null = 'Integer';
    static override description: string | null = 'A numeric value';

    static default: number = 48;
    static min: number = 8;
    static max: number = 128;

    override value: string;
    numericValue: number;

    constructor(value: string | number) {
        const strValue = String(value);
        super(strValue);
        this.value = strValue;
        this.numericValue = typeof value === 'number' ? value : parseInt(value, 10) || 0;
    }

    /**
     * Create a configured Int type.
     * @example
     * ```typescript
     * class FontSize extends Int.with({ label: 'Font Size', min: 12, max: 200 }) {}
     * ```
     */
    static with(options: IntOptions): typeof Int {
        const Base = this;
        return class extends Base {
            static override label = options.label ?? Base.label;
            static override description = options.description ?? Base.description;
            static override default = options.default ?? Base.default;
            static override min = options.min ?? Base.min;
            static override max = options.max ?? Base.max;
        };
    }
}

export interface ColorOptions {
    label?: string;
    description?: string;
    default?: string;
}

export class Color extends Argument {
    static override types: ColumnType[] = [ColumnType.Argument];
    static override label: string | null = 'Color';
    static override description: string | null = 'A color value';

    static default: string = '#000000';

    constructor(value: string) {
        super(value);
    }

    /**
     * Create a configured Color type.
     * @example
     * ```typescript
     * class FontColor extends Color.with({ label: 'Font Color', default: '#1f77b4' }) {}
     * ```
     */
    static with(options: ColorOptions): typeof Color {
        const Base = this;
        return class extends Base {
            static override label = options.label ?? Base.label;
            static override description = options.description ?? Base.description;
            static override default = options.default ?? Base.default;
        };
    }
}

