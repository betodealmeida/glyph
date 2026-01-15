import { tableFromArrays } from 'apache-arrow';
import { Metric } from '../lib/types';
import { BigNumber } from '../lib/charts/BigNumber';

function App() {
    // Sample data
    const dataFrame = tableFromArrays({
        revenue: new Float32Array([1234567.89]),
    });
    const metric = new Metric('revenue');

    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui', maxWidth: '900px' }}>
            <h1>Glyph - Semantic Charts</h1>

            <section style={{ marginBottom: '40px' }}>
                <h2>Pure reflection with createChart</h2>
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
                    background: BigNumber.chartArguments.size > 0 ? '#e8f5e9' : '#ffebee',
                    padding: '10px'
                }}>
                    {BigNumber.chartArguments.size > 0
                        ? JSON.stringify(
                            Array.from(BigNumber.chartArguments.entries()).map(([k, v]) => [k, v.name]),
                            null, 2
                        )
                        : 'No arguments discovered'}
                </pre>
            </section>

            <section>
                <h2>Rendered Chart</h2>
                <div style={{ border: '1px solid #4caf50', padding: '20px' }}>
                    <BigNumber metric={metric} dataFrame={dataFrame} />
                </div>
            </section>
        </div>
    );
}

export default App;
