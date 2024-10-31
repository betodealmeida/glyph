export class Metric {

    static label: string | null = null;
    static description: string | null = null;

    values: ArrayLike<unknown>;

    constructor(values: ArrayLike<unknown>) {
        this.values = values;
    }
}
