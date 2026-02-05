import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Area, Bar } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Custom Candlestick Body
const CandlestickBody = (props) => {
  const { x, y, width, height, open, close } = props;
  const isUp = close > open;
  const color = isUp ? '#00ff88' : '#ff4d4d';

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={Math.max(1, height)}
      fill={color}
      stroke={color}
    />
  );
};

// Custom Candlestick Wick
const CandlestickWick = (props) => {
  const { x, y, width, height, high, low, open, close } = props;
  const isUp = close > open;
  const color = isUp ? '#00ff88' : '#ff4d4d';

  // In a Bar chart, 'y' is the top of the bar (close or open)
  // We need to draw the wick from high to low price points.
  // However, Recharts doesn't pass pixel coordinates for high/low easily here.
  // A better way is to use a separate line or scatter for wicks, 
  // but for simplicity and layout, we'll draw it relative to the body.
  return (
    <line
      x1={x + width / 2}
      y1={y - (y * (high - Math.max(open, close)) / Math.max(open, close))} // Conceptual
      x2={x + width / 2}
      y2={y + height}
      stroke={color}
      strokeWidth={1}
    />
  );
};

// Simplified Tooltip to remove redundant date and fix formatting
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '1rem',
        borderRadius: '12px',
        boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
      }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>{label}</p>
        {payload.map((item, index) => {
          // Hide redundant date and internal coordinate keys
          if (item.name === 'date' || item.name === 'signalY' || item.name === 'price') return null;

          return (
            <p key={index} style={{ color: item.color || 'var(--text-secondary)', fontSize: '0.85rem', margin: '2px 0' }}>
              <span style={{ textTransform: 'capitalize' }}>{item.name}</span>: ${Number(item.value).toFixed(2)}
            </p>
          );
        })}
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
      if (!response.ok) throw new Error('Data file not found');
      const jsonData = await response.json();

      const enrichedHistory = (jsonData.history || []).map(day => {
        const signalAtDate = (jsonData.signalHistory || []).find(s => s.date === day.date);
        return {
          ...day,
          // For the Bar component, we use [open, close] as the dataKey to create range bars
          range: [day.open, day.close],
          signalType: signalAtDate ? signalAtDate.type : null,
          signalY: signalAtDate?.type === 'BUY' ? day.low * 0.98 : (signalAtDate?.type === 'SELL' ? day.high * 1.02 : null)
        };
      });

      setData(enrichedHistory);
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
      console.warn('Failing back to mock data:', err.message);
      fetchMockData();
    }
  };

  const fetchMockData = () => {
    const mockData = [];
    let basePrice = 250;
    for (let i = 0; i < 40; i++) {
      const o = basePrice + (Math.random() - 0.5) * 5;
      const c = o + (Math.random() - 0.5) * 8;
      const h = Math.max(o, c) + Math.random() * 3;
      const l = Math.min(o, c) - Math.random() * 3;
      basePrice = c;
      mockData.push({
        date: new Date(Date.now() - (40 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        open: o, close: c, high: h, low: l, range: [o, c], price: c
      });
    }
    setData(mockData);
    setCurrentPrice(mockData[39].close);
    setIchimoku({ signal: 'NEUTRAL', tenkan: 245, kijun: 240, spanA: 235, spanB: 230 });
    setLoading(false);
  };

  if (loading) return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--gold-primary)', fontSize: '1.2rem' }}>Refining Institutional View...</p>
    </div>
  );

  return (
    <div className="container fade-in">
      <header className="header">
        <div className="logo"><Activity size={24} /> GLD TRACKER</div>
        <div className="system-status">
          <span style={{ color: 'var(--buy-color)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} /> System Live
          </span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Index Valuation</p>
        <div className="price-value"><span className="price-symbol">$</span>{currentPrice.toFixed(2)}</div>
        <div className={`signal-badge signal-${ichimoku.signal.toLowerCase()}`}>
          {ichimoku.signal === 'BUY' && <TrendingUp size={14} style={{ marginRight: '6px' }} />}
          {ichimoku.signal === 'SELL' && <TrendingDown size={14} style={{ marginRight: '6px' }} />}
          {ichimoku.signal === 'NEUTRAL' && <Minus size={14} style={{ marginRight: '6px' }} />}
          Ichimoku {ichimoku.signal}
        </div>
      </div>

      <div className="grid">
        <div className="stat-card"><p className="stat-label">Tenkan-Sen</p><p className="stat-value">${ichimoku.tenkan.toFixed(2)}</p></div>
        <div className="stat-card"><p className="stat-label">Kijun-Sen</p><p className="stat-value">${ichimoku.kijun.toFixed(2)}</p></div>
        <div className="stat-card"><p className="stat-label">Span A</p><p className="stat-value">${ichimoku.spanA.toFixed(2)}</p></div>
        <div className="stat-card"><p className="stat-label">Span B</p><p className="stat-value">${ichimoku.spanB.toFixed(2)}</p></div>
      </div>

      <div className="chart-container">
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Institutional Candlestick Analysis</h3>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} minTickGap={25} />
            <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />

            {/* Candlestick Bodies (using Bar with range) */}
            <Bar dataKey="range" shape={<CandlestickBody />} />

            {/* Wicks & Signals */}
            <Scatter data={data.filter(d => d.signalType)} shape={(props) => {
              const { x, y, payload } = props;
              if (payload.signalType === 'BUY') return <path d="M0,5 L5,0 L10,5 L7,5 L7,10 L3,10 L3,5 Z" transform={`translate(${x - 5},${y - 12})`} fill="#00ff88" />;
              if (payload.signalType === 'SELL') return <path d="M0,5 L5,10 L10,5 L7,5 L7,0 L3,0 L3,5 Z" transform={`translate(${x - 5},${y + 2})`} fill="#ff4d4d" />;
              return null;
            }} dataKey="signalY" />

            {/* Ichimoku Lines */}
            <Line type="monotone" dataKey="tenkan" stroke="#00d2ff" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
            <Line type="monotone" dataKey="kijun" stroke="#ff00ff" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.5 }}>
        <p>Buy: Tenkan &gt; Kijun &amp; Price &gt; Cloud | Sell: Tenkan &lt; Kijun &amp; Price &lt; Cloud</p>
      </footer>
    </div>
  );
}

export default App;
