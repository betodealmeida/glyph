apache arrow
drag and drop metrics (eg, BigNumber)
drag and drop to axes


SELECT BigNumber(metric) FROM (
    SELECT COUNT(*) AS metric FROM t)
)
