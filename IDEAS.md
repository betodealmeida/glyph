# Glyph Ideas & Roadmap

## Current State

We have a working proof-of-concept with:
- `createChart()` with TypeScript reflection via `typescript-rtti`
- `.with()` pattern for creating custom argument types
- Automatic Superset control generation from typed function parameters
- Working charts: `BigNumber`, `FancyBigNumber`

## Next: New Charts

### Line Chart
- Temporal X-axis support (time series data)
- Multiple metrics support
- Dimension for grouping/coloring lines

New types needed:
```typescript
class Temporal extends Argument {
    // Maps to Superset's time column controls
    static types = [ColumnType.Temporal];
}

// Usage
class TimeAxis extends Temporal.with({ label: 'Time', granularity: 'day' }) {}

function lineChart(
    dataFrame: Table,
    time: TimeAxis,
    metric: Metric,
    groupBy?: Dimension  // Optional: creates multiple lines
) { ... }
```

### Pie Chart
- Single metric for values
- Dimension for slices

```typescript
function pieChart(
    dataFrame: Table,
    metric: Metric,
    slices: Dimension
) { ... }
```

---

## Future: Drag & Drop into Charts

### Concept
Instead of only configuring charts via the control panel, users can drag columns/metrics directly onto the visualization. Drop targets are derived from the chart's argument metadata.

### How It Would Work

1. **Define drop targets via `.with()`:**
```typescript
class XAxis extends Dimension.with({
    label: 'X Axis',
    dropTarget: { position: 'bottom', hint: 'Drop dimension for X axis' }
}) {}

class YAxis extends Dimension.with({
    label: 'Y Axis',
    dropTarget: { position: 'left', hint: 'Drop dimension for Y axis' }
}) {}

class BubbleSize extends Metric.with({
    label: 'Size',
    dropTarget: { position: 'center', hint: 'Drop metric for bubble size' }
}) {}

function scatterPlot(x: XAxis, y: YAxis, size: BubbleSize) { ... }
```

2. **Charts always render, even without data:**

The problem: Charts don't render until metrics/columns are selected and "Update chart" is clicked. No chart = no drop zones.

The solution: Glyph charts render a **skeleton UI** when arguments are missing:

```
┌─────────────────────────────────────┐
│                                     │
│         ┌─────────────────┐         │
│         │  Drop metric    │         │
│         │  for bubble     │         │
│         │  size           │         │
│         └─────────────────┘         │
│                                     │
├─────────────────────────────────────┤
│        Drop dimension for X axis    │
└─────────────────────────────────────┘
```

The skeleton:
- Shows the chart's structure before data is loaded
- Displays active drop zones based on argument metadata
- Serves as visual onboarding ("this chart needs X, Y, and size")
- Transforms empty state from a problem into a feature

3. **Superset integration:**
- Integrate with Superset's `react-dnd` context
- On drop, call `setControlValue(controlName, droppedValue)`
- Type matching: Metric targets accept metrics, Dimension targets accept columns

### Implementation Considerations
- Mapping abstract positions ("bottom", "left", "center") to chart geometry
- Consistent visual language for drop targets across chart types
- Coordinating skeleton rendering with the Glyph wrapper
- Accessing Superset's DnD context and control update APIs

---

## Other Ideas

```sql
-- SQL-like syntax for chart composition?
SELECT BigNumber(metric) FROM (
    SELECT COUNT(*) AS metric FROM t
)
```
