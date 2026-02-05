import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Bar, Cell } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Extremely defensive formatting helper
const formatVal = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toFixed(2);
};

// Simplified, crash-proof Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data) return null;

    return (
      <div style={{
        background: 'rgba(15, 15, 20, 0.98)',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '1rem',
        borderRadius: '12px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.8)',
        minWidth: '200px'
      }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>{label}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>O: <span style={{ color: 'var(--text-primary)' }}>${formatVal(data.open)}</span></p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>C: <span style={{ color: 'var(--text-primary)' }}>${formatVal(data.close)}</span></p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>H: <span style={{ color: '#00ff88' }}>${formatVal(data.high)}</span></p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>L: <span style={{ color: '#ff4d4d' }}>${formatVal(data.low)}</span></p>
        </div>
        <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '0.7rem', color: '#00d2ff', margin: '2px 0' }}>Tenkan: ${formatVal(data.tenkan)}</p>
          <p style={{ fontSize: '0.7rem', color: '#ff00ff', margin: '2px 0' }}>Kijun: ${formatVal(data.kijun)}</p>
        </div>
      </div>
    );
  }
  return null;
};

// Simple Candle Body Shape
const CandleBody = (props) => {
  const { x, y, width, height, payload } = props;
  if (x === undefined || isNaN(x) || !payload) return null;
  const isUp = payload.close >= payload.open;
  return <rect x={x} y={y} width={width} height={Math.max(1, height)} fill={isUp ? '#00ff88' : '#ff4d4d'} />;
};

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [ichimoku, setIchimoku] = useState(null);
  const [domain, setDomain] = useState(['auto', 'auto']);

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealData = async () => {
    try {
      const response = await fetch('/data.json');
      if (!response.ok) throw new Error('Source offline');
      const jsonData = await response.json();

      let min = Infinity;
      let max = -Infinity;

      // Use the history array directly - it already has OHLC and indicators
      const history = (jsonData.history || []).map(day => {
        // Match signals from signalHistory
        const signalAtDate = (jsonData.signalHistory || []).find(s => {
          const sDate = s.date?.split('T')[0];
          const dDate = day.date?.split('T')[0];
          return sDate === dDate;
        });

        // Track extremes for chart framing (including all values)
        const values = [day.low, day.high, day.tenkan, day.kijun, day.spanA, day.spanB].filter(v => v != null && !isNaN(v));
        values.forEach(v => {
          if (v < min) min = v;
          if (v > max) max = v;
        });

        return {
          date: day.date,
          open: day.open,
          close: day.close,
          high: day.high,
          low: day.low,
          tenkan: day.tenkan,
          kijun: day.kijun,
          spanA: day.spanA,
          spanB: day.spanB,
          // For Recharts Bar rendering
          bodyRange: [day.open, day.close],
          wickRange: [day.low, day.high],
          // Signal markers
          signalType: signalAtDate ? (signalAtDate.type || signalAtDate.signal) : null,
          sigY: signalAtDate ? (signalAtDate.type === 'BUY' || signalAtDate.signal === 'BUY' ? day.low * 0.98 : day.high * 1.02) : null
        };
      });
      if (min !== Infinity) {
        setDomain([Math.floor(min * 0.96), Math.ceil(max * 1.04)]);
      }

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
      console.error('Data loading error:', err.message);
      fetchMockData();
    }
  };

  const fetchMockData = () => {
    setData([]); // Clear to avoid partial state crashes
    setLoading(false);
    // Minimal fallback state
    setIchimoku({ signal: 'NEUTRAL', tenkan: 0, kijun: 0, spanA: 0, spanB: 0 });
  };

  if (loading) return (
    <div style={{ background: '#0a0a0c', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#d4af37', fontSize: '1rem', letterSpacing: '4px' }}>ACCESSING MARKET DATA...</p>
    </div>
  );

  // Final safety check before render
  if (!ichimoku) return null;

  return (
    <div className="container fade-in">
      <header className="header">
        <div className="logo"><Activity size={18} /> GLD TRACKER</div>
        <div className="system-status">
          <span style={{ color: '#00ff88', fontSize: '0.7rem', fontWeight: '900' }}>● ONLINE</span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Spot Valuation</p>
        <div className="price-value"><span className="price-symbol">$</span>{formatVal(currentPrice)}</div>
        <div className={`signal-badge signal-${(ichimoku.signal || 'neutral').toLowerCase()}`}>
          {ichimoku.signal === 'BUY' ? <TrendingUp size={14} /> : (ichimoku.signal === 'SELL' ? <TrendingDown size={14} /> : <Minus size={14} />)}
          &nbsp;{ichimoku.signal || 'NEUTRAL'}
        </div>
      </div>

      <div className="grid">
        <div className="stat-card"><p className="stat-label">Tenkan</p><p className="stat-value">${formatVal(ichimoku.tenkan)}</p></div>
        <div className="stat-card"><p className="stat-label">Kijun</p><p className="stat-value">${formatVal(ichimoku.kijun)}</p></div>
        <div className="stat-card"><p className="stat-label">Cloud A</p><p className="stat-value">${formatVal(ichimoku.spanA)}</p></div>
        <div className="stat-card"><p className="stat-label">Cloud B</p><p className="stat-value">${formatVal(ichimoku.spanB)}</p></div>
      </div>

      <div className="chart-container" style={{ padding: '2rem 0' }}>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} domain={domain} tickFormatter={v => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />

            {/* Wicks */}
            <Bar dataKey="wickRange" barSize={1} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={`w-${index}`} fill={entry.close >= entry.open ? '#00ff88' : '#ff4d4d'} fillOpacity={0.3} />
              ))}
            </Bar>

            {/* Bodies */}
            <Bar dataKey="bodyRange" shape={<CandleBody />} isAnimationActive={false} />

            {/* Signals */}
            <Scatter data={data.filter(d => d.signalType)} shape={(props) => {
              const { x, y, payload } = props;
              if (payload?.signalType === 'BUY') return <path d="M0,5 L5,0 L10,5 L7,5 L7,10 L3,10 L3,5 Z" transform={`translate(${x - 5},${y - 12})`} fill="#00ff88" />;
              if (payload?.signalType === 'SELL') return <path d="M0,5 L5,10 L10,5 L7,5 L7,0 L3,0 L3,5 Z" transform={`translate(${x - 5},${y + 2})`} fill="#ff4d4d" />;
              return null;
            }} dataKey="sigY" />

            {/* Ichimoku Lines */}
            <Line type="monotone" dataKey="tenkan" stroke="#00d2ff" strokeWidth={2} dot={false} strokeOpacity={0.8} />
            <Line type="monotone" dataKey="kijun" stroke="#ff00ff" strokeWidth={2} dot={false} strokeOpacity={0.8} />
            <Line type="monotone" dataKey="spanA" stroke="#00ff88" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.3} />
            <Line type="monotone" dataKey="spanB" stroke="#ff4d4d" strokeWidth={1} dot={false} strokeDasharray="4 4" strokeOpacity={0.3} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.3, fontSize: '0.6rem', letterSpacing: '1px' }}>
        <p>INSTITUTIONAL SIGNAL TRACKING ENGINE</p>
      </footer>
    </div>
  );
}

export default App;
