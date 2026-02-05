import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Cell, Area } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Custom Candlestick Component for Recharts
const Candlestick = (props) => {
  const { x, y, width, height, low, high, open, close } = props;
  const isUp = close > open;
  const color = isUp ? '#00ff88' : '#ff4d4d';
  const ratio = Math.abs(open - close) / Math.abs(high - low);

  return (
    <g stroke={color} strokeWidth={2}>
      {/* Wicks */}
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} />
      {/* Body */}
      <rect
        x={x}
        y={isUp ? y + (height * (high - close)) / (high - low) : y + (height * (high - open)) / (high - low)}
        width={width}
        height={Math.max(1, (height * Math.abs(open - close)) / (high - low))}
        fill={color}
      />
    </g>
  );
};

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [ichimoku, setIchimoku] = useState(null);
  const [signalHistory, setSignalHistory] = useState([]);

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

      // Merge signal history into plot data
      const enrichedHistory = (jsonData.history || []).map(day => {
        const signalAtDate = (jsonData.signalHistory || []).find(s => s.date === day.date);
        return {
          ...day,
          signalType: signalAtDate ? signalAtDate.type : null,
          // Position the arrow slightly above or below the candle
          signalY: signalAtDate?.type === 'BUY' ? day.low * 0.995 : (signalAtDate?.type === 'SELL' ? day.high * 1.005 : null)
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
      const open = basePrice + (Math.random() - 0.5) * 5;
      const close = open + (Math.random() - 0.5) * 8;
      const high = Math.max(open, close) + Math.random() * 3;
      const low = Math.min(open, close) - Math.random() * 3;
      basePrice = close;

      mockData.push({
        date: new Date(Date.now() - (40 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        price: parseFloat(close.toFixed(2))
      });
    }
    setData(mockData);
    setCurrentPrice(mockData[mockData.length - 1].close);
    setIchimoku({ signal: 'NEUTRAL', tenkan: 245, kijun: 240, spanA: 235, spanB: 230 });
    setLoading(false);
  };

  if (loading) return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--gold-primary)', fontSize: '1.2rem' }}>Loading Institutional Feed...</p>
    </div>
  );

  return (
    <div className="container fade-in">
      <header className="header">
        <div className="logo"><Activity size={24} /> GLD TRACKER</div>
        <div className="system-status">
          <span style={{ color: 'var(--buy-color)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} /> System Active
          </span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Index Value</p>
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
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Candlestick Signal Analysis</h3>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />

            {/* Candlesticks */}
            <Scatter data={data} shape={<Candlestick />} />

            {/* Signal Markers */}
            <Scatter data={data.filter(d => d.signalType)} shape={(props) => {
              const { x, y, payload } = props;
              if (payload.signalType === 'BUY') return <path d="M0,5 L5,0 L10,5 L7,5 L7,10 L3,10 L3,5 Z" transform={`translate(${x - 5},${y - 15})`} fill="#00ff88" />;
              if (payload.signalType === 'SELL') return <path d="M0,5 L5,10 L10,5 L7,5 L7,0 L3,0 L3,5 Z" transform={`translate(${x - 5},${y + 5})`} fill="#ff4d4d" />;
              return null;
            }} dataKey="signalY" />

            {/* Ichimoku Lines */}
            {ichimoku && (
              <>
                <Line type="monotone" dataKey="tenkan" stroke="#00d2ff" strokeWidth={1} dot={false} strokeOpacity={0.5} />
                <Line type="monotone" dataKey="kijun" stroke="#ff00ff" strokeWidth={1} dot={false} strokeOpacity={0.5} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.6 }}>
        <p>Buy: Tenkan > Kijun & Price > Cloud | Sell: Tenkan < Kijun & Price < Cloud</p>
      </footer>
    </div>
  );
}

export default App;
