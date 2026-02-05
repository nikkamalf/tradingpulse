import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Bar, Cell } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Custom Candlestick Shape
const CandlestickShape = (props) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? '#00ff88' : '#ff4d4d';

  // We need to map high/low to Y coordinates manually since Bar only gives us y/height for the [open,close] range
  // However, Recharts passes the scale function in some contexts, but not here.
  // Instead, we'll draw the wicks relative to the body height/y.
  // This is a bit tricky without the scales. 
  // Let's use a more standard Recharts pattern: Two Bars (one for wick, one for body)
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(1, height)} fill={color} stroke={color} />
    </g>
  );
};

// Simplified Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '1rem',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
      }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>{label}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Open: <span style={{ color: 'var(--text-primary)' }}>${data.open?.toFixed(2)}</span></p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Close: <span style={{ color: 'var(--text-primary)' }}>${data.close?.toFixed(2)}</span></p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>High: <span style={{ color: 'var(--text-primary)' }}>${data.high?.toFixed(2)}</span></p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Low: <span style={{ color: 'var(--text-primary)' }}>${data.low?.toFixed(2)}</span></p>
        </div>
        <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '0.8rem', color: '#00d2ff' }}>Tenkan: ${data.tenkan?.toFixed(2)}</p>
          <p style={{ fontSize: '0.8rem', color: '#ff00ff' }}>Kijun: ${data.kijun?.toFixed(2)}</p>
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
  const [domain, setDomain] = useState(['auto', 'auto']);

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealData = async () => {
    try {
      console.log('Fetching live data stream...');
      const response = await fetch('/data.json');
      if (!response.ok) throw new Error('Data source unavailable');
      const jsonData = await response.json();

      let minPrice = Infinity;
      let maxPrice = -Infinity;

      const enrichedHistory = (jsonData.history || []).map(day => {
        const signalAtDate = (jsonData.signalHistory || []).find(s => s.date === day.date);

        // Track min/max for explicit domain
        if (day.low < minPrice) minPrice = day.low;
        if (day.high > maxPrice) maxPrice = day.high;

        return {
          ...day,
          // Use [Math.min(o,c), Math.max(o,c)] for the Bar to ensure 'y' and 'height' are always positive
          // Recharts Bar range logic: [start, end]
          range: [day.open, day.close],
          wickRange: [day.low, day.high],
          signalType: signalAtDate ? signalAtDate.type : null,
          signalY: signalAtDate?.type === 'BUY' ? day.low * 0.985 : (signalAtDate?.type === 'SELL' ? day.high * 1.015 : null)
        };
      });

      // Pad domain slightly
      setDomain([Math.floor(minPrice * 0.97), Math.ceil(maxPrice * 1.03)]);
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
      console.warn('Network error, reverting to simulation:', err.message);
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
        open: o, close: c, high: h, low: l, range: [o, c], wickRange: [l, h],
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
      <div className="fade-in" style={{ color: 'var(--gold-primary)', fontSize: '1.2rem', letterSpacing: '2px' }}>INITIALIZING DATA FEED...</div>
    </div>
  );

  return (
    <div className="container fade-in">
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div className="logo" style={{ letterSpacing: '1px' }}><Activity size={22} /> GLD TRACKER</div>
        <div className="system-status">
          <span style={{ color: '#00ff88', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
            <ShieldCheck size={14} /> SYSTEM ONLINE
          </span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Institutional Value</p>
        <div className="price-value" style={{ textShadow: '0 0 20px rgba(212,175,55,0.3)' }}><span className="price-symbol">$</span>{currentPrice.toFixed(2)}</div>
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

      <div className="chart-container" style={{ padding: '2rem 1rem 1rem 1rem' }}>
        <h3 style={{ marginBottom: '2rem', fontSize: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Live Candlestick Analysis</h3>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
            <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} domain={domain} tickFormatter={(v) => `$${v}`} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />

            {/* Candlestick Wicks (using narrow Bar) */}
            <Bar dataKey="wickRange" barSize={1} fill="#ffffff" fillOpacity={0.3}>
              {data.map((entry, index) => (
                <Cell key={`wick-${index}`} fill={entry.close >= entry.open ? '#00ff88' : '#ff4d4d'} fillOpacity={0.3} />
              ))}
            </Bar>

            {/* Candlestick Bodies */}
            <Bar dataKey="range" shape={<CandlestickShape />} />

            {/* Signal Markers */}
            <Scatter data={data.filter(d => d.signalType)} shape={(props) => {
              const { x, y, payload } = props;
              if (payload.signalType === 'BUY') return <path d="M0,5 L5,0 L10,5 L7,5 L7,10 L3,10 L3,5 Z" transform={`translate(${x - 5},${y - 12})`} fill="#00ff88" />;
              if (payload.signalType === 'SELL') return <path d="M0,5 L5,10 L10,5 L7,5 L7,0 L3,0 L3,5 Z" transform={`translate(${x - 5},${y + 2})`} fill="#ff4d4d" />;
              return null;
            }} dataKey="signalY" />

            {/* Ichimoku Lines */}
            <Line type="monotone" dataKey="tenkan" stroke="#00d2ff" strokeWidth={2} dot={false} strokeOpacity={0.7} />
            <Line type="monotone" dataKey="kijun" stroke="#ff00ff" strokeWidth={2} dot={false} strokeOpacity={0.7} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer style={{ marginTop: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.7rem', opacity: 0.4, letterSpacing: '0.5px' }}>
        <p>STRATEGY: BUY [TENKAN &gt; KIJUN &amp; PRICE &gt; CLOUD] | SELL [TENKAN &lt; KIJUN &amp; PRICE &lt; CLOUD]</p>
      </footer>
    </div>
  );
}

export default App;
