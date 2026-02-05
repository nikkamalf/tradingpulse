import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Bar, Cell } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Custom Tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Find the actual data object (it might be in payload[0].payload)
    const data = payload[0].payload;
    if (!data) return null;

    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '1rem',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        minWidth: '180px'
      }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>{label}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>O: <span style={{ color: 'var(--text-primary)' }}>${data.open?.toFixed(2)}</span></p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>C: <span style={{ color: 'var(--text-primary)' }}>${data.close?.toFixed(2)}</span></p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>H: <span style={{ color: 'var(--text-primary)' }}>${data.high?.toFixed(2)}</span></p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>L: <span style={{ color: 'var(--text-primary)' }}>${data.low?.toFixed(2)}</span></p>
        </div>
        <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '0.75rem', color: '#00d2ff', margin: '2px 0' }}>Tenkan: ${data.tenkan?.toFixed(2)}</p>
          <p style={{ fontSize: '0.75rem', color: '#ff00ff', margin: '2px 0' }}>Kijun: ${data.kijun?.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Candlestick Body Shape
const CandleShape = (props) => {
  const { x, y, width, height, payload } = props;
  if (!payload || x === undefined || isNaN(x)) return null;

  const isUp = payload.close >= payload.open;
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
      if (!response.ok) throw new Error('Data fetch failed');
      const jsonData = await response.json();

      let min = Infinity;
      let max = -Infinity;

      const enrichedHistory = (jsonData.history || []).map(day => {
        const signalAtDate = (jsonData.signalHistory || []).find(s => s.date === day.date);

        // Find min/max for the whole dataset (including indicators)
        const vals = [day.low, day.high, day.tenkan, day.kijun, day.spanA, day.spanB].filter(v => v != null);
        vals.forEach(v => {
          if (v < min) min = v;
          if (v > max) max = v;
        });

        return {
          ...day,
          // Recharts Bar range: [startValue, endValue]
          bodyRange: [day.open, day.close],
          wickRange: [day.low, day.high],
          signalType: signalAtDate ? signalAtDate.type : null,
          signalY: signalAtDate?.type === 'BUY' ? day.low * 0.98 : (signalAtDate?.type === 'SELL' ? day.high * 1.02 : null)
        };
      });

      if (min === Infinity) {
        setDomain(['auto', 'auto']);
      } else {
        setDomain([Math.floor(min * 0.95), Math.ceil(max * 1.05)]);
      }

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
    let base = 250;
    for (let i = 0; i < 40; i++) {
      const o = base + (Math.random() - 0.5) * 5;
      const c = o + (Math.random() - 0.5) * 8;
      const h = Math.max(o, c) + Math.random() * 3;
      const l = Math.min(o, c) - Math.random() * 3;
      base = c;
      mockData.push({
        date: new Date(Date.now() - (40 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        open: o, close: c, high: h, low: l, bodyRange: [o, c], wickRange: [l, h],
        tenkan: base - 2, kijun: base - 5
      });
    }
    setData(mockData);
    setDomain(['auto', 'auto']);
    setCurrentPrice(mockData[39].close);
    setIchimoku({ signal: 'NEUTRAL', tenkan: 245, kijun: 240, spanA: 235, spanB: 230 });
    setLoading(false);
  };

  if (loading) return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--gold-primary)', fontSize: '1.2rem', letterSpacing: '4px' }}>ACCESSING MARKET FEED...</p>
    </div>
  );

  return (
    <div className="container fade-in">
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div className="logo" style={{ letterSpacing: '1px' }}><Activity size={22} /> GOLD TRACKER</div>
        <div className="system-status">
          <span style={{ color: '#00ff88', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
            <ShieldCheck size={14} /> SYSTEM LIVE
          </span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Institutional Value</p>
        <div className="price-value" style={{ textShadow: '0 0 15px rgba(212,175,55,0.4)' }}><span className="price-symbol">$</span>{currentPrice.toFixed(2)}</div>
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
        <h3 style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.8 }}>Live Technical Analysis</h3>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} domain={domain} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />

            {/* Wicks */}
            <Bar dataKey="wickRange" barSize={1} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={`wick-${index}`} fill={entry.close >= entry.open ? '#00ff88' : '#ff4d4d'} fillOpacity={0.4} />
              ))}
            </Bar>

            {/* Bodies */}
            <Bar dataKey="bodyRange" shape={<CandleShape />} isAnimationActive={false} />

            {/* Signals */}
            <Scatter data={data.filter(d => d.signalType)} shape={(props) => {
              const { x, y, payload } = props;
              if (!payload) return null;
              if (payload.signalType === 'BUY') return <path d="M0,5 L5,0 L10,5 L7,5 L7,10 L3,10 L3,5 Z" transform={`translate(${x - 5},${y - 12})`} fill="#00ff88" />;
              if (payload.signalType === 'SELL') return <path d="M0,5 L5,10 L10,5 L7,5 L7,0 L3,0 L3,5 Z" transform={`translate(${x - 5},${y + 2})`} fill="#ff4d4d" />;
              return null;
            }} dataKey="signalY" />

            {/* Indicators */}
            <Line type="monotone" dataKey="tenkan" stroke="#00d2ff" strokeWidth={1.5} dot={false} strokeOpacity={0.6} isAnimationActive={false} />
            <Line type="monotone" dataKey="kijun" stroke="#ff00ff" strokeWidth={1.5} dot={false} strokeOpacity={0.6} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer style={{ marginTop: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.65rem', opacity: 0.4, letterSpacing: '1px' }}>
        <p>STRATEGY: BUY IF TENKAN &gt; KIJUN + PRICE &gt; CLOUD | SELL IF TENKAN &lt; KIJUN + PRICE &lt; CLOUD</p>
      </footer>
    </div>
  );
}

export default App;
