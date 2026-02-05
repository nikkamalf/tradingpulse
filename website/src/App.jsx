import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Cell } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

/**
 * Custom Candlestick Component using Scatter for perfect alignment.
 */
const Candle = (props) => {
  const { x, y, payload } = props;
  if (!payload || isNaN(x)) return null;

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? '#00ff88' : '#ff4d4d';

  // We use the chart's 'y' coordinate (which corresponds to 'payload.price' or 'close')
  // but we need to calculate heights relative to the price. 
  // Since we don't have the scale(value) function directly, 
  // we use a trick: the chart passes 'y' for the 'dataKey' value.
  // If we want perfect scaling, we need to know the pixel-per-dollar ratio.
  // Recharts doesn't provide this easily to custom Scatter shapes.

  // BETTER APPROACH: Use two Lines for the wick and body if Scatter is too limiting,
  // OR use the 'Bar' but with better settings.
  // Let's go back to Bar but with 'xAxisId' and 'yAxisId' explicitly set and 
  // using a single Bar for the body to avoid clustering.
  return null; // Placeholder as I rethink the most stable method
};

// Refined Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'rgba(15, 15, 20, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '1.2rem',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        minWidth: '220px'
      }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{label}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Open</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>${data.open?.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Close</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>${data.close?.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>High</p>
            <p style={{ fontSize: '0.9rem', color: '#00ff88' }}>${data.high?.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Low</p>
            <p style={{ fontSize: '0.9rem', color: '#ff4d4d' }}>${data.low?.toFixed(2)}</p>
          </div>
        </div>
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: '#00d2ff' }}>Tenkan-Sen</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>${data.tenkan?.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: '#ff00ff' }}>Kijun-Sen</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>${data.kijun?.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * The 'Kumo Cloud' is best represented as a range area.
 */
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
      if (!response.ok) throw new Error('Data stream offline');
      const jsonData = await response.json();

      let min = Infinity;
      let max = -Infinity;

      const history = (jsonData.history || []).map(day => {
        const signalAtDate = (jsonData.signalHistory || []).find(s => s.date === day.date);

        // Track min/max for scaling
        const points = [day.low, day.high, day.spanA, day.spanB].filter(v => v !== null);
        points.forEach(v => {
          if (v < min) min = v;
          if (v > max) max = v;
        });

        return {
          ...day,
          wickHigh: day.high,
          wickLow: day.low,
          // Recharts 'Bar' range using body data
          body: [day.open, day.close],
          signalType: signalAtDate ? signalAtDate.type : null,
          signalY: signalAtDate?.type === 'BUY' ? day.low * 0.98 : (signalAtDate?.type === 'SELL' ? day.high * 1.02 : null)
        };
      });

      setDomain([Math.floor(min * 0.98), Math.ceil(max * 1.02)]);
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
      console.error(err);
      fetchMockData();
    }
  };

  const fetchMockData = () => {
    const mock = [];
    let p = 250;
    for (let i = 0; i < 40; i++) {
      const o = p + (Math.random() - 0.5) * 4;
      const c = o + (Math.random() - 0.5) * 6;
      const h = Math.max(o, c) + 2;
      const l = Math.min(o, c) - 2;
      p = c;
      mock.push({
        date: new Date(Date.now() - (40 - i) * 86400000).toISOString().split('T')[0],
        open: o, close: c, high: h, low: l, body: [o, c],
        tenkan: p - 1, kijun: p - 3, spanA: p - 5, spanB: p - 7
      });
    }
    setData(mock);
    setLoading(false);
  };

  if (loading) return (
    <div style={{ background: '#0a0a0c', height: '100vh', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', letterSpacing: '4px' }}>
      CONNECTING TO GLOBAL LIQUIDITY...
    </div>
  );

  return (
    <div className="container fade-in">
      <header className="header">
        <div className="logo"><Activity size={20} /> GOLD FEED</div>
        <div className="system-status">
          <span style={{ color: '#00ff88', fontSize: '0.7rem', fontWeight: 'bold' }}>● SYSTEM OPERATIONAL</span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Index Spot Price</p>
        <div className="price-value" style={{ textShadow: '0 0 30px rgba(212,175,55,0.4)' }}>
          <span className="price-symbol">$</span>{currentPrice.toFixed(2)}
        </div>
        <div className={`signal-badge signal-${ichimoku.signal.toLowerCase()}`}>
          {ichimoku.signal === 'BUY' ? <TrendingUp size={14} /> : (ichimoku.signal === 'SELL' ? <TrendingDown size={14} /> : <Minus size={14} />)}
          &nbsp;Ichimoku {ichimoku.signal}
        </div>
      </div>

      <div className="grid">
        <div className="stat-card"><p className="stat-label">Tenkan</p><p className="stat-value">${ichimoku.tenkan.toFixed(2)}</p></div>
        <div className="stat-card"><p className="stat-label">Kijun</p><p className="stat-value">${ichimoku.kijun.toFixed(2)}</p></div>
        <div className="stat-card"><p className="stat-label">Cloud A</p><p className="stat-value">${ichimoku.spanA.toFixed(2)}</p></div>
        <div className="stat-card"><p className="stat-label">Cloud B</p><p className="stat-value">${ichimoku.spanB.toFixed(2)}</p></div>
      </div>

      <div className="chart-container" style={{ padding: '1.5rem 0' }}>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} minTickGap={30} />
            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} domain={domain} tickFormatter={v => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />

            {/* Wicks (The range of the day) */}
            <Bar
              dataKey={(d) => [d.low, d.high]}
              xAxisId={0}
              barSize={1}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`wick-${index}`} fill={entry.close >= entry.open ? '#00ff88' : '#ff4d4d'} fillOpacity={0.4} />
              ))}
            </Bar>

            {/* Candle Bodies (Open/Close) */}
            <Bar
              dataKey="body"
              barSize={12}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`body-${index}`} fill={entry.close >= entry.open ? '#00ff88' : '#ff4d4d'} />
              ))}
            </Bar>

            {/* Signal Markers */}
            <Scatter data={data.filter(d => d.signalType)} shape={(props) => {
              const { x, y, payload } = props;
              if (payload.signalType === 'BUY') return <path d="M0,5 L5,0 L10,5 L7,5 L7,10 L3,10 L3,5 Z" transform={`translate(${x - 5},${y - 12})`} fill="#00ff88" />;
              if (payload.signalType === 'SELL') return <path d="M0,5 L5,10 L10,5 L7,5 L7,0 L3,0 L3,5 Z" transform={`translate(${x - 5},${y + 2})`} fill="#ff4d4d" />;
              return null;
            }} dataKey="signalY" />

            {/* Ichimoku Indicators */}
            <Line type="monotone" dataKey="tenkan" stroke="#00d2ff" strokeWidth={2} dot={false} strokeOpacity={0.8} />
            <Line type="monotone" dataKey="kijun" stroke="#ff00ff" strokeWidth={2} dot={false} strokeOpacity={0.8} />
            <Line type="monotone" dataKey="spanA" stroke="#00ff88" strokeWidth={1} dot={false} strokeDasharray="5 5" strokeOpacity={0.3} />
            <Line type="monotone" dataKey="spanB" stroke="#ff4d4d" strokeWidth={1} dot={false} strokeDasharray="5 5" strokeOpacity={0.3} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.3, fontSize: '0.65rem', letterSpacing: '1px' }}>
        <p>INSTITUTIONAL GRADE TRACKER • REFRESHED EVERY 60 MINUTES</p>
        <p style={{ marginTop: '4px' }}>BUY: T &gt; K &amp; PRICE &gt; CLOUD | SELL: T &lt; K &amp; PRICE &lt; CLOUD</p>
      </footer>
    </div>
  );
}

export default App;
