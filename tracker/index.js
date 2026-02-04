// Set this for environments with corporate proxy SSL interception (e.g., Netskope)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const nodemailer = require('nodemailer');
const { DateTime } = require('luxon');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    recipient: process.env.RECIPIENT_EMAIL || 'nikkamalf@gmail.com',
    ticker: process.env.TICKER || 'GLD',
    historyPath: path.resolve(__dirname, 'alert-history.json'),
    websiteDataPath: path.resolve(__dirname, '../website/public/data.json'),
};

/**
 * Fetches historical data from Stooq CSV API.
 * Stooq is more stable than Yahoo Finance in many environments.
 */
async function fetchHistoricalData(ticker) {
    // GLD corresponds to gld.us on Stooq
    const symbol = ticker.toLowerCase() === 'gld' ? 'gld.us' : ticker.toLowerCase();
    const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;

    console.log(`Fetching data from Stooq for ${symbol}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Stooq fetch failed: ${response.statusText}`);

    const csv = await response.text();
    const lines = csv.trim().split('\n');

    // Header: Date,Open,High,Low,Close,Volume
    // Data starts from index 1. We need at least 78 days for Ichimoku.
    return lines.slice(1).map(line => {
        const [date, open, high, low, close, volume] = line.split(',');
        return {
            date: new Date(date),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close)
        };
    }).filter(d => !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close));
}

/**
 * Calculates Ichimoku Cloud components.
 */
function calculateIchimoku(data) {
    const getPeriodHighLow = (slice) => {
        let high = -Infinity;
        let low = Infinity;
        for (const d of slice) {
            if (d.high > high) high = d.high;
            if (d.low < low) low = d.low;
        }
        return { high, low };
    };

    // Latest index is at the end of the array (Stooq historical data is chronological)

    // Tenkan-sen (9 periods)
    const tenkanSlice = data.slice(-9);
    const tenkanHL = getPeriodHighLow(tenkanSlice);
    const tenkan = (tenkanHL.high + tenkanHL.low) / 2;

    // Kijun-sen (26 periods)
    const kijunSlice = data.slice(-26);
    const kijunHL = getPeriodHighLow(kijunSlice);
    const kijun = (kijunHL.high + kijunHL.low) / 2;

    // Senkou Span A (plotted 26 ahead)
    // We calculate it as the average of Tenkan and Kijun from 26 periods ago
    const t26_slice = data.slice(-26 - 9, -26);
    const k26_slice = data.slice(-26 - 26, -26);
    if (t26_slice.length < 9 || k26_slice.length < 26) {
        throw new Error('Not enough data to calculate Senkou Span A (need at least 52 periods)');
    }
    const tenkan26 = (getPeriodHighLow(t26_slice).high + getPeriodHighLow(t26_slice).low) / 2;
    const kijun26 = (getPeriodHighLow(k26_slice).high + getPeriodHighLow(k26_slice).low) / 2;
    const senkouA = (tenkan26 + kijun26) / 2;

    // Senkou Span B (52 periods, plotted 26 ahead)
    // We calculate it as the long-term HL midpoint from 52 periods ago, shifted 26 back
    const b52Slice = data.slice(-52 - 26, -26);
    if (b52Slice.length < 52) {
        throw new Error('Not enough data to calculate Senkou Span B (need at least 78 periods)');
    }
    const b52HL = getPeriodHighLow(b52Slice);
    const senkouB = (b52HL.high + b52HL.low) / 2;

    const latest = data[data.length - 1];

    return {
        tenkan,
        kijun,
        senkouA,
        senkouB,
        price: latest.close,
        date: latest.date.toISOString(),
    };
}

/**
 * Sends email alert via SMTP.
 */
async function sendEmail(subject, body) {
    if (!CONFIG.user || !CONFIG.pass) {
        console.warn('SMTP credentials missing. Skipping email notification.');
        console.log('--- EMAIL MOCK ---');
        console.log(`To: ${CONFIG.recipient}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log('------------------');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: CONFIG.host,
        port: CONFIG.port,
        secure: false, // true for 465, false for 587
        auth: {
            user: CONFIG.user,
            pass: CONFIG.pass,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"Gold Tracker" <${CONFIG.user}>`,
            to: CONFIG.recipient,
            subject: subject,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        });
        console.log('Message sent: %s', info.messageId);
    } catch (err) {
        console.error('Failed to send email:', err.message);
    }
}

/**
 * Prevents duplicate alerts for the same signal on the same day.
 */
function checkAlertHistory(signal, date) {
    if (!fs.existsSync(CONFIG.historyPath)) {
        fs.writeFileSync(CONFIG.historyPath, JSON.stringify({}));
    }
    const history = JSON.parse(fs.readFileSync(CONFIG.historyPath, 'utf8'));
    const key = `${signal}-${date.split('T')[0]}`;
    if (history[key]) return true;
    history[key] = true;
    fs.writeFileSync(CONFIG.historyPath, JSON.stringify(history));
    return false;
}

/**
 * Main execution loop.
 */
async function run() {
    try {
        console.log(`Checking ${CONFIG.ticker} for Ichimoku signals...`);
        const data = await fetchHistoricalData(CONFIG.ticker);

        // We need at least 78 data points for Senkou Span B (52 length + 26 plot ahead)
        if (data.length < 78) {
            console.log(`Not enough historical data yet (${data.length}/78 days).`);
            return;
        }

        const ichimoku = calculateIchimoku(data);
        const { tenkan, kijun, senkouA, senkouB, price, date } = ichimoku;

        console.log(`Latest data date: ${date.split('T')[0]}`);
        console.log(`Current Price: $${price.toFixed(2)}`);
        console.log(`Tenkan: ${tenkan.toFixed(2)} | Kijun: ${kijun.toFixed(2)}`);
        console.log(`Cloud: Span A=${senkouA.toFixed(2)} | Span B=${senkouB.toFixed(2)}`);

        let signal = '';

        // Ichimoku Logic (Daily Timeframe):
        // BUY: Tenkan > Kijun AND Price > Cloud
        // SELL: Tenkan < Kijun AND Price < Cloud
        if (tenkan > kijun && price > Math.max(senkouA, senkouB)) {
            signal = 'BUY';
        } else if (tenkan < kijun && price < Math.min(senkouA, senkouB)) {
            signal = 'SELL';
        }

        if (signal) {
            if (!checkAlertHistory(signal, date)) {
                console.log(`Generating a new ${signal} signal!`);
                await sendEmail(
                    `${signal} Signal Alert: ${CONFIG.ticker}`,
                    `Ichimoku ${signal} signal detected for ${CONFIG.ticker} on the daily timeframe.\n\n` +
                    `Metrics:\n` +
                    `- Price: $${price.toFixed(2)}\n` +
                    `- Tenkan-Sen: ${tenkan.toFixed(2)}\n` +
                    `- Kijun-Sen: ${kijun.toFixed(2)}\n` +
                    `- Senkou Span A: ${senkouA.toFixed(2)}\n` +
                    `- Senkou Span B: ${senkouB.toFixed(2)}\n\n` +
                    `Status: Active`
                );
            } else {
                console.log(`Signal ${signal} was already alerted for this date.`);
            }
        } else {
            console.log('No signal detected based on current Ichimoku parameters.');
        }

        // Save data for the website
        const websiteData = {
            ticker: CONFIG.ticker,
            price: price,
            date: date,
            signal: signal || 'NEUTRAL',
            ichimoku: {
                tenkan,
                kijun,
                senkouA,
                senkouB
            },
            history: data.slice(-30).map(d => ({
                date: d.date.toISOString().split('T')[0],
                price: d.close
            }))
        };
        fs.writeFileSync(CONFIG.websiteDataPath, JSON.stringify(websiteData, null, 2));
        console.log(`Updated website data at ${CONFIG.websiteDataPath}`);

    } catch (error) {
        console.error('Error in Gold Tracker execution:', error.message);
    }
}

// Start the script
run();
