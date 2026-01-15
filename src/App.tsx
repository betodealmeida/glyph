import { tableFromArrays } from 'apache-arrow';
import { Metric } from '../lib/types';
import { BigNumber } from '../lib/charts/BigNumber';
import { BigNumberPure } from '../lib/charts/BigNumber/pure';

function App() {
    // Sample data
    const dataFrame = tableFromArrays({
        revenue: new Float32Array([1234567.89]),
    });
    const metric = new Metric('revenue');

    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui', maxWidth: '900px' }}>
            <h1>Glyph Reflection Test</h1>

            <section style={{ marginBottom: '40px' }}>
                <h2>Old way: explicit metadata</h2>
                <pre style={{ background: '#f5f5f5', padding: '15px' }}>
{`function BigNumber({ metric, dataFrame }: BigNumberProps) { ... }

BigNumber.metadata = {
    arguments: { metric: Metric },  // Manual duplication!
};`}
                </pre>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h2>New way: pure reflection with createChart</h2>
                <pre style={{ background: '#e8f5e9', padding: '15px' }}>
{`const BigNumber = createChart(
    'Big Number',
    (dataFrame: Table, metric: Metric) => (
        <h1>{dataFrame.get(0)?.[metric.value]}</h1>
    )
);

// That's it! Arguments discovered automatically via reflection.`}
                </pre>

                <p><strong>Discovered arguments:</strong></p>
                <pre style={{
                    background: BigNumberPure.chartArguments.size > 0 ? '#e8f5e9' : '#ffebee',
                    padding: '10px'
                }}>
                    {BigNumberPure.chartArguments.size > 0
                        ? JSON.stringify(
                            Array.from(BigNumberPure.chartArguments.entries()).map(([k, v]) => [k, v.name]),
                            null, 2
                        )
                        : 'No arguments discovered'}
                </pre>
            </section>

            <section>
                <h2>Both render identically</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ border: '1px solid #ccc', padding: '20px' }}>
                        <h4>Old (explicit metadata)</h4>
                        <BigNumber metric={metric} dataFrame={dataFrame} />
                    </div>
                    <div style={{ border: '1px solid #4caf50', padding: '20px' }}>
                        <h4>New (pure reflection)</h4>
                        <BigNumberPure metric={metric} dataFrame={dataFrame} />
                    </div>
                </div>
            </section>
        </div>
    );
}

export default App;
