import { tableFromArrays } from 'apache-arrow';
import { Metric } from '../lib/types';
import { getArguments } from '../lib/main';
import { BigNumber } from '../lib/charts/BigNumber';
import { createSupersetPlugin, SupersetChartProps } from '../lib/interfaces/superset';

function App() {
    // === GLYPH: Simple, semantic API ===
    // Just define your chart with semantic types
    const sources = ['Revenue Q4'];
    const values = new Float32Array([1234567.89]);
    const metric = new Metric('revenue');
    const dataFrame = tableFromArrays({ source: sources, revenue: values });

    // Show reflection results
    console.log('=== Glyph Reflection ===');
    console.log('Chart arguments:', getArguments(BigNumber as React.FC<unknown>));

    // === SUPERSET ADAPTER: Auto-generate plugin ===
    // The adapter introspects the chart and generates everything Superset needs
    const supersetPlugin = createSupersetPlugin(BigNumber);

    console.log('\n=== Generated Superset Plugin ===');
    console.log('Metadata:', supersetPlugin.metadata);
    console.log('Control Panel:', JSON.stringify(supersetPlugin.controlPanel, null, 2));

    // Simulate what Superset would send to the chart
    const mockSupersetProps: SupersetChartProps = {
        width: 400,
        height: 200,
        formData: {
            metric: 'revenue',  // User selected this in Superset's metric dropdown
        },
        queriesData: [{
            data: [{ source: 'Revenue Q4', revenue: 1234567.89 }],
        }],
    };

    // Transform Superset's format to Glyph's format
    const glyphProps = supersetPlugin.transformProps(mockSupersetProps);
    console.log('\n=== Transformed Props ===');
    console.log('Metric value:', (glyphProps.metric as Metric).value);

    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h2>Glyph → Superset Proof of Concept</h2>

            <section style={{ marginBottom: '40px' }}>
                <h3>1. Native Glyph Usage</h3>
                <p>Simple, semantic API:</p>
                <pre style={{ background: '#f5f5f5', padding: '10px' }}>
{`function BigNumber(metric: Metric) { ... }

<BigNumber metric={new Metric('revenue')} dataFrame={data} />`}
                </pre>
                <div style={{ border: '1px solid #ccc', padding: '20px', background: '#fff' }}>
                    <BigNumber metric={metric} dataFrame={dataFrame} />
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <h3>2. Auto-Generated Superset Plugin</h3>
                <p>The adapter introspects the chart and generates:</p>

                <h4>Control Panel (UI configuration)</h4>
                <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
{JSON.stringify(supersetPlugin.controlPanel, null, 2)}
                </pre>

                <h4>Metadata</h4>
                <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
{JSON.stringify(supersetPlugin.metadata, null, 2)}
                </pre>
            </section>

            <section>
                <h3>3. Superset → Glyph Transform</h3>
                <p>Superset sends:</p>
                <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
{JSON.stringify(mockSupersetProps, null, 2)}
                </pre>
                <p>Glyph receives:</p>
                <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
{`{
  metric: Metric { value: '${(glyphProps.metric as Metric).value}' },
  dataFrame: Table (${glyphProps.dataFrame.numRows} rows)
}`}
                </pre>

                <h4>Rendered via transformProps:</h4>
                <div style={{ border: '1px solid #ccc', padding: '20px', background: '#fff' }}>
                    <BigNumber {...glyphProps} />
                </div>
            </section>
        </div>
    );
}

export default App;
