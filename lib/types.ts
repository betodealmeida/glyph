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

// XXX add types for Palette, PaletteMap, Font, etc. to be used as props in chart components
// they should also have label and description properties
