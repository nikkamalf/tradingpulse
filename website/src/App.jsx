import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, ScatterChart, ZAxis, ComposedChart, Area } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Helper to format values safely
const formatVal = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toFixed(2);
};

// Custom Candlestick rendering using a custom dot on the Line chart
const CandlestickDot = (props) => {
  const { cx, cy, payload } = props;
  if (!payload || cx === undefined) return null;

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? '#00ff88' : '#ff4d4d';

  // Calculate approximate pixel scale (this is a hack but works for most cases)
  // We'll draw a simple representation
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.abs(close - open);

  // For this to work we'd need the Y scale, so let's use a simpler approach
  // Just draw a vertical line with a thicker middle section
  return (
    <g>
      {/* Wick - from high to low */}
      <line x1={cx} y1={cy - 20} x2={cx} y2={cy + 20} stroke={color} strokeWidth={1} opacity={0.6} />
      {/* Body - thicker section */}
      <rect x={cx - 3} y={cy - 5} width={6} height={10} fill={color} />
    </g>
  );
};

// Clean tooltip
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'rgba(10, 10, 12, 0.95)',
        border: '1px solid rgba(255,255,255,0.2)',
        padding: '1rem',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
      }}>
        <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{data.date}</p>
        <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
          <p style={{ color: '#fff' }}>O: ${formatVal(data.open)} | C: ${formatVal(data.close)}</p>
          <p style={{ color: '#00ff88' }}>H: ${formatVal(data.high)} | <span style={{ color: '#ff4d4d' }}>L: ${formatVal(data.low)}</span></p>
          <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
          <p style={{ color: '#00d2ff' }}>Tenkan: ${formatVal(data.tenkan)}</p>
          <p style={{ color: '#ff00ff' }}>Kijun: ${formatVal(data.kijun)}</p>
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

      // Use history array directly - it already has all the data we need
      const history = (jsonData.history || []).map(day => {
        // Find matching signal
        const signal = (jsonData.signalHistory || []).find(s => {
          const sDate = s.date?.split('T')[0];
          const dDate = day.date?.split('T')[0];
          return sDate === dDate;
        });

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
        <div className="chart-container" style={{ padding: '2rem 0' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px' }}>Technical Chart Analysis</h3>
          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.3)"
                fontSize={9}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={v => `$${Math.round(v)}`}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Price area for visual weight */}
              <Area
                type="monotone"
                dataKey="close"
                fill="url(#priceGradient)"
                stroke="transparent"
                isAnimationActive={false}
              />

              {/* Ichimoku lines */}
              <Line
                type="monotone"
                dataKey="tenkan"
                stroke="#00d2ff"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="kijun"
                stroke="#ff00ff"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="spanA"
                stroke="#00ff88"
                strokeWidth={1}
                dot={false}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="spanB"
                stroke="#ff4d4d"
                strokeWidth={1}
                dot={false}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                isAnimationActive={false}
              />

              {/* Price line with emphasis */}
              <Line
                type="monotone"
                dataKey="close"
                stroke="#d4af37"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />

              {/* Signal markers */}
              <Scatter
                data={data.filter(d => d.signalType)}
                dataKey="close"
                shape={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload) return null;
                  if (payload.signalType === 'BUY') {
                    return <path d="M0,6 L6,0 L12,6 L8,6 L8,12 L4,12 L4,6 Z" transform={`translate(${cx - 6},${cy - 18})`} fill="#00ff88" />;
                  }
                  if (payload.signalType === 'SELL') {
                    return <path d="M0,6 L6,12 L12,6 L8,6 L8,0 L4,0 L4,6 Z" transform={`translate(${cx - 6},${cy + 6})`} fill="#ff4d4d" />;
                  }
                  return null;
                }}
              />

              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4af37" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <footer style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.25, fontSize: '0.65rem' }}>
        <p>INSTITUTIONAL SIGNAL TRACKER • UPDATES HOURLY</p>
      </footer>
    </div>
  );
}

export default App;
