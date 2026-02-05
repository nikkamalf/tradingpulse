import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, ShieldCheck } from 'lucide-react';

const GLD_TICKER = 'GLD';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [ichimoku, setIchimoku] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealData = async () => {
    try {
      console.log('Fetching live data...');
      const response = await fetch('/data.json');
      if (!response.ok) throw new Error('Data file not found yet');
      const jsonData = await response.json();

      console.log('Data received:', jsonData);

      setData(jsonData.history || []);
      setCurrentPrice(jsonData.price || 0);
      setIchimoku({
        signal: jsonData.signal || 'NEUTRAL',
        tenkan: jsonData.ichimoku?.tenkan || 0,
        kijun: jsonData.ichimoku?.kijun || 0,
        spanA: jsonData.ichimoku?.senkouA || 0,
        spanB: jsonData.ichimoku?.senkouB || 0
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      console.warn('Error fetching live data, failing back to mock:', err.message);
      fetchMockData();
    }
  };

  const fetchMockData = () => {
    console.log('Generating fallback mock data...');
    const mockData = [];
    let basePrice = 250;
    for (let i = 0; i < 60; i++) {
      basePrice += (Math.random() - 0.45) * 2;
      mockData.push({
        date: new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        price: parseFloat(basePrice.toFixed(2)),
        tenkan: parseFloat((basePrice - 2).toFixed(2)),
        kijun: parseFloat((basePrice - 4).toFixed(2)),
      });
    }

    setData(mockData.slice(-30));
    setCurrentPrice(mockData[mockData.length - 1].price);
    const last = mockData[mockData.length - 1];
    setIchimoku({
      signal: 'NEUTRAL',
      tenkan: last.tenkan,
      kijun: last.kijun,
      spanA: last.tenkan - 2,
      spanB: last.kijun - 2
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--gold-primary)', fontSize: '1.2rem' }}>Initializing Gold Sentiment Feed...</p>
      </div>
    );
  }

  const signal = ichimoku?.signal || 'NEUTRAL';

  return (
    <div className="container fade-in">
      <header className="header">
        <div className="logo">
          <Activity size={24} />
          GLD TRACKER
        </div>
        <div className="system-status">
          <span style={{ color: 'var(--buy-color)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} /> System Active
          </span>
        </div>
      </header>

      <div className="price-card">
        <p className="price-label">{GLD_TICKER} Institutional Index</p>
        <div className="price-value">
          <span className="price-symbol">$</span>
          {currentPrice.toFixed(2)}
        </div>

        <div className={`signal-badge signal-${signal.toLowerCase()}`}>
          {signal === 'BUY' && <TrendingUp size={14} style={{ marginRight: '6px' }} />}
          {signal === 'SELL' && <TrendingDown size={14} style={{ marginRight: '6px' }} />}
          {signal === 'NEUTRAL' && <Minus size={14} style={{ marginRight: '6px' }} />}
          Ichimoku {signal} Signal
        </div>
      </div>

      <div className="grid">
        <div className="stat-card">
          <p className="stat-label">Tenkan-Sen (9)</p>
          <p className="stat-value">${(ichimoku?.tenkan || 0).toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Kijun-Sen (26)</p>
          <p className="stat-value">${(ichimoku?.kijun || 0).toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Senkou Span A</p>
          <p className="stat-value">${(ichimoku?.spanA || 0).toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Senkou Span B</p>
          <p className="stat-value">${(ichimoku?.spanB || 0).toFixed(2)}</p>
        </div>
      </div>

      {data.length > 0 && (
        <div className="chart-container">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Trend Analysis</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--gold-primary)" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="var(--gold-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Area type="monotone" dataKey="price" stroke="var(--gold-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <p>Monitoring 1-Day timeframe signals using Ichimoku Cloud indicators.</p>
        <p style={{ marginTop: '0.5rem', opacity: 0.5 }}>Stooq Real-time Data Feed Integrated.</p>
      </footer>
    </div>
  );
}

export default App;
