import { BigNumber, Metric } from '../'

function App() {
    const values = new Float32Array([Math.PI]);
    const metric = new Metric(values);

    return <BigNumber metric={metric} />;
}

export default App
