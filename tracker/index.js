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
 */
async function fetchHistoricalData(ticker) {
    const symbol = ticker.toLowerCase() === 'gld' ? 'gld.us' : ticker.toLowerCase();
    const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;

    console.log(`Fetching data from Stooq for ${symbol}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Stooq fetch failed: ${response.statusText}`);

    const csv = await response.text();
    const lines = csv.trim().split('\n');

    return lines.slice(1).map(line => {
        const [date, open, high, low, close, volume] = line.split(',');
        return {
            date: new Date(date),
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close)
        };
    }).filter(d => !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close));
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

    const tenkanSlice = data.slice(-9);
    const tenkanHL = getPeriodHighLow(tenkanSlice);
    const tenkan = (tenkanHL.high + tenkanHL.low) / 2;

    const kijunSlice = data.slice(-26);
    const kijunHL = getPeriodHighLow(kijunSlice);
    const kijun = (kijunHL.high + kijunHL.low) / 2;

    const t26_slice = data.slice(-26 - 9, -26);
    const k26_slice = data.slice(-26 - 26, -26);
    if (t26_slice.length < 9 || k26_slice.length < 26) {
        throw new Error('Not enough data to calculate Senkou Span A');
    }
    const tenkan26 = (getPeriodHighLow(t26_slice).high + getPeriodHighLow(t26_slice).low) / 2;
    const kijun26 = (getPeriodHighLow(k26_slice).high + getPeriodHighLow(k26_slice).low) / 2;
    const senkouA = (tenkan26 + kijun26) / 2;

    const b52Slice = data.slice(-52 - 26, -26);
    if (b52Slice.length < 52) {
        throw new Error('Not enough data to calculate Senkou Span B');
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
        console.warn('SMTP credentials missing. Skipping email.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: CONFIG.host,
        port: CONFIG.port,
        secure: false,
        auth: { user: CONFIG.user, pass: CONFIG.pass },
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
        console.error('Email failed:', err.message);
    }
}

/**
 * Prevents duplicate alerts.
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

        if (data.length < 78) {
            console.log(`Not enough data (${data.length}/78 days).`);
            return;
        }

        const ichimoku = calculateIchimoku(data);
        const { tenkan, kijun, senkouA, senkouB, price, date } = ichimoku;

        console.log(`Latest date: ${date.split('T')[0]}`);
        console.log(`Price: $${price.toFixed(2)}`);

        let signal = '';
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
                    `Ichimoku ${signal} signal detected for ${CONFIG.ticker}.\n\nPrice: $${price.toFixed(2)}`
                );
            }
        }

        // --- Persistent Signal History for Charting ---
        const historyData = JSON.parse(fs.existsSync(CONFIG.historyPath) ? fs.readFileSync(CONFIG.historyPath, 'utf8') : '{}');
        const signalsArray = Object.keys(historyData).map(key => {
            const parts = key.split('-');
            const type = parts[0];
            const d = parts.slice(1).join('-'); // Recombine YYYY-MM-DD
            return { type, date: d };
        });

        // Prepare data for website
        const websiteData = {
            ticker: CONFIG.ticker,
            price: price,
            date: date,
            signal: signal || 'NEUTRAL',
            signalHistory: signalsArray,
            ichimoku: { tenkan, kijun, senkouA, senkouB },
            history: data.slice(-40).map(d => ({
                date: d.date.toISOString().split('T')[0],
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                price: d.close
            }))
        };

        // Ensure the website directory exists
        const dir = path.dirname(CONFIG.websiteDataPath);
        if (!fs.existsSync(dir)) {
            console.log(`Creating directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(CONFIG.websiteDataPath, JSON.stringify(websiteData, null, 2));
        console.log(`Updated website data at ${CONFIG.websiteDataPath}`);

    } catch (error) {
        console.error('Critical Error:', error.message);
        process.exit(1);
    }
}

run();
