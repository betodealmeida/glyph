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
}

export class Dimension extends Argument {
    static override types: ColumnType[] = [ColumnType.Dimension];
}

// XXX add types for Palette, PaletteMap, Font, etc. to be used as props in chart components
// they should also have label and description properties
