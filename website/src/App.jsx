import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Customized } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

const formatVal = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toFixed(2);
};

// Ichimoku Cloud - fills between spanA and spanB
const IchimokuCloud = ({ data, xAxisMap, yAxisMap }) => {
  if (!data || !xAxisMap || !yAxisMap) return null;
  const xScale = xAxisMap['date']?.scale;
  const yScale = yAxisMap['price']?.scale;
  if (!xScale || !yScale) return null;

  const validData = data.filter(d => d.spanA != null && d.spanB != null);
  if (validData.length < 2) return null;

  let pathData = `M ${xScale(validData[0].date)} ${yScale(validData[0].spanA)}`;
  for (let i = 1; i < validData.length; i++) {
    pathData += ` L ${xScale(validData[i].date)} ${yScale(validData[i].spanA)}`;
  }
  for (let i = validData.length - 1; i >= 0; i--) {
    pathData += ` L ${xScale(validData[i].date)} ${yScale(validData[i].spanB)}`;
  }
  pathData += ' Z';

  return <path d={pathData} fill="#00ff88" fillOpacity={0.12} stroke="none" />;
};

// Candlesticks renderer
const Candlesticks = ({ data, xAxisMap, yAxisMap, width }) => {
  if (!data || !xAxisMap || !yAxisMap) return null;
  const xScale = xAxisMap['date']?.scale;
  const yScale = yAxisMap['price']?.scale;
  if (!xScale || !yScale) return null;

  const validData = data.filter(d => d.open && d.close && d.high && d.low);
  const barWidth = Math.max(4, Math.min(12, (width / validData.length) * 0.7));

  return (
    <g>
      {validData.map((item, idx) => {
        const x = xScale(item.date);
        const yH = yScale(item.high);
        const yL = yScale(item.low);
        const yO = yScale(item.open);
        const yC = yScale(item.close);
        const up = item.close >= item.open;
        const color = up ? '#00ff88' : '#ff4d4d';
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(1, Math.abs(yC - yO));

        return (
          <g key={`c-${idx}`}>
            <line x1={x} y1={yH} x2={x} y2={yL} stroke={color} strokeWidth={1} />
            <rect x={x - barWidth / 2} y={bodyTop} width={barWidth} height={bodyH} fill={color} />
          </g>
        );
      })}
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const d = payload[0].payload;
    return (
      <div style={{ background: 'rgba(10,10,12,0.95)', border: '1px solid rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
        <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{d.date}</p>
        <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
          <p style={{ color: '#fff' }}>O: ${formatVal(d.open)} | C: ${formatVal(d.close)}</p>
          <p style={{ color: '#00ff88' }}>H: ${formatVal(d.high)} | <span style={{ color: '#ff4d4d' }}>L: ${formatVal(d.low)}</span></p>
          <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
          <p style={{ color: '#40E0D0' }}>Tenkan: ${formatVal(d.tenkan)}</p>
          <p style={{ color: '#DC143C' }}>Kijun: ${formatVal(d.kijun)}</p>
        </div>
      </div>
    );
  }
  return null;
};

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [ichimoku, setIchimoku] = useState(null);

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealData = async () => {
    try {
      const response = await fetch('/data.json');
      if (!response.ok) throw new Error('Data unavailable');
      const jsonData = await response.json();

      const history = (jsonData.history || []).map(day => {
        const signal = (jsonData.signalHistory || []).find(s => s.date?.split('T')[0] === day.date?.split('T')[0]);
        return {
          date: day.date?.split('T')[0] || day.date,
          open: day.open,
          close: day.close,
          high: day.high,
          low: day.low,
          tenkan: day.tenkan,
          kijun: day.kijun,
          spanA: day.spanA,
          spanB: day.spanB,
          signalType: signal ? (signal.type || signal.signal) : null
        };
      });

      setData(history);
      setCurrentPrice(jsonData.price || 0);
      setIchimoku({
        signal: jsonData.signal || 'NEUTRAL',
        tenkan: jsonData.ichimoku?.tenkan || 0,
        kijun: jsonData.ichimoku?.kijun || 0,
        spanA: jsonData.ichimoku?.senkouA || 0,
        spanB: jsonData.ichimoku?.senkouB || 0
      });
      setLoading(false);
    } catch (err) {
      console.error('Data fetch error:', err.message);
      setData([]);
      setIchimoku({ signal: 'NEUTRAL', tenkan: 0, kijun: 0, spanA: 0, spanB: 0 });
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ background: '#0a0a0c', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#d4af37', fontSize: '1rem', letterSpacing: '3px' }}>LOADING MARKET DATA...</p>
    </div>
  );

  if (!ichimoku) return null;

  return (
    <div className="container fade-in">
      <header className="header">
        <div className="logo"><Activity size={18} /> GLD TRACKER</div>
        <div className="system-status">
          <span style={{ color: '#00ff88', fontSize: '0.7rem', fontWeight: '900' }}>● LIVE</span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Spot Price</p>
        <div className="price-value"><span className="price-symbol">$</span>{formatVal(currentPrice)}</div>
        <div className={`signal-badge signal-${(ichimoku.signal || 'neutral').toLowerCase()}`}>
          {ichimoku.signal === 'BUY' ? <TrendingUp size={12} /> : (ichimoku.signal === 'SELL' ? <TrendingDown size={12} /> : <Minus size={12} />)}
          &nbsp;{ichimoku.signal || 'NEUTRAL'}
        </div>
      </div>

      <div className="grid">
        <div className="stat-card"><p className="stat-label">Tenkan</p><p className="stat-value">${formatVal(ichimoku.tenkan)}</p></div>
        <div className="stat-card"><p className="stat-label">Kijun</p><p className="stat-value">${formatVal(ichimoku.kijun)}</p></div>
        <div className="stat-card"><p className="stat-label">Cloud A</p><p className="stat-value">${formatVal(ichimoku.spanA)}</p></div>
        <div className="stat-card"><p className="stat-label">Cloud B</p><p className="stat-value">${formatVal(ichimoku.spanB)}</p></div>
      </div>

      {data.length > 0 && (
        <div className="chart-container" style={{ padding: '2rem 1rem' }}>
          <h3 style={{ marginBottom: '1.5rem', marginLeft: '2rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px' }}>Technical Chart Analysis</h3>
          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={9} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={50} />
              <YAxis yAxisId="price" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={v => `$${Math.round(v)}`} />
              <Tooltip content={<CustomTooltip />} />

              {/* Cloud between spanA and spanB */}
              <Customized component={(props) => <IchimokuCloud {...props} data={data} />} />

              {/* Ichimoku indicator lines */}
              <Line yAxisId="price" type="monotone" dataKey="tenkan" stroke="#40E0D0" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="price" type="monotone" dataKey="kijun" stroke="#DC143C" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="price" type="monotone" dataKey="spanA" stroke="#2E8B57" strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line yAxisId="price" type="monotone" dataKey="spanB" stroke="#8B4513" strokeWidth={1} dot={false} isAnimationActive={false} />

              {/* Candlesticks on top */}
              <Customized component={(props) => <Candlesticks {...props} data={data} />} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <footer style={{
        marginTop: '2rem', textAlign: 'center', opacity: 0.25', fontSize: '0.65rem' }}>
          <p>INSTITUTIONAL SIGNAL TRACKER • UPDATES HOURLY</p>
            </footer >
        </div >
    );
}

export default App;
