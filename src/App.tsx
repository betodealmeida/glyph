import { tableFromArrays } from 'apache-arrow';
import { BigNumber, Metric } from '../'

function App() {
    const sources = ['source1'];
    const values = new Float32Array([Math.PI]);
    const metric = new Metric('pi');
    const dataFrame = tableFromArrays({ source: sources, pi: values });

    return <BigNumber metric={metric} dataFrame={dataFrame} />;
}

export default App
