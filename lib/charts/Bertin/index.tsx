import { Argument, ChartProps, ColumnType } from '../../types';


class XAxis extends Argument {
    static override types: ColumnType[] = [ColumnType.Dimension, ColumnType.Metric]; 
    static override label: string = 'X Axis';
    static override description: string = 'The dimension or metric corresponding to the X Axis';
}


interface BertinProps extends ChartProps {
    xAxis: XAxis;
}

export function Bertin({ xAxis, dataFrame }: BertinProps) {
    console.log(xAxis);
    console.log(dataFrame);
    return <h1>unexpected data</h1>;
}

// Bertin.metadata = { ... };
