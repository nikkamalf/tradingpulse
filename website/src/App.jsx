import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, Bar, Cell } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GLD_TICKER = 'GLD';

// Helper to format values safely
const formatVal = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toFixed(2);
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
          <p style={{ color: '#40E0D0' }}>Tenkan: ${formatVal(data.tenkan)}</p>
          <p style={{ color: '#DC143C' }}>Kijun: ${formatVal(data.kijun)}</p>
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

      // Process history data for candlestick visualization
      const history = (jsonData.history || []).map(day => {
        const signal = (jsonData.signalHistory || []).find(s => {
          const sDate = s.date?.split('T')[0];
          const dDate = day.date?.split('T')[0];
          return sDate === dDate;
        });

        // For candlestick using Bar stacking
        const bodyLow = Math.min(day.open, day.close);
        const bodyHigh = Math.max(day.open, day.close);
        const wickLow = day.low;
        const wickHigh = day.high;

        return {
          date: day.date?.split('T')[0] || day.date,
          open: day.open,
          close: day.close,
          high: day.high,
          low: day.low,
          // Candlestick parts
          wickBottom: wickLow,
          wickHeight: wickHigh - wickLow,
          bodyBottom: bodyLow,
          bodyHeight: bodyHigh - bodyLow,
          isUp: day.close >= day.open,
          // Ichimoku
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

              {/* Ichimoku Cloud - fill between spanA and spanB */}
              <Area
                type="monotone"
                dataKey="spanA"
                stroke="transparent"
                fill="#00ff88"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="spanB"
                stroke="transparent"
                fill="#00ff88"
                fillOpacity={0}
                isAnimationActive={false}
              />

              {/* Ichimoku Lines */}
              <Line
                type="monotone"
                dataKey="tenkan"
                stroke="#40E0D0"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="kijun"
                stroke="#DC143C"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="spanA"
                stroke="#2E8B57"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="spanB"
                stroke="#8B4513"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />

              {/* Candlesticks using Bars - Wicks (thin line from low to high) */}
              <Bar dataKey="wickHeight" stackId="candle" barSize={1} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell key={`wick-${index}`} fill={entry.isUp ? '#00ff88' : '#ff4d4d'} />
                ))}
              </Bar>

              {/* Candlesticks - Bodies (thicker bar from open to close) */}
              <Bar dataKey="bodyHeight" stackId="candle" barSize={10} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell key={`body-${index}`} fill={entry.isUp ? '#00ff88' : '#ff4d4d'} />
                ))}
              </Bar>

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
