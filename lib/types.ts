import { Table } from 'apache-arrow';

/*
 * Base interface for all chart components.
 */
export interface ChartProps {
    dataFrame: Table;
}

export enum ColumnType {
    Metric = 'metric',
    Dimension = 'dimension',
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
}

/**
 * Style/visual argument types - these generate UI controls in Superset
 */

export class Int extends Argument {
    static override types: ColumnType[] = [ColumnType.Argument];
    static override label = 'Integer';
    static override description = 'A numeric value';

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
}

export class Color extends Argument {
    static override types: ColumnType[] = [ColumnType.Argument];
    static override label = 'Color';
    static override description = 'A color value';

    static default: string = '#000000';

    constructor(value: string) {
        super(value);
    }
}
