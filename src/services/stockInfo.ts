import { formatAmount, convertToNumber } from '../utils/convertToNumber';
import axios from 'axios'

interface Market {
    status_id: number; // 市场状态ID，2代表盘前交易
    region: string; // 地区，例如 "US" 代表美国
    status: string; // 市场状态描述，例如 "盘前交易",5代表盘中交易
    time_zone: string; // 时区，例如 "America/New_York"
    time_zone_desc: string | null; // 时区描述
    delay_tag: number; // 延迟标识
}

interface Quote {

    current_ext?: number; // 当前价格（扩展精度）
    symbol: string; // 股票代码
    high52w: number; // 52 周最高价
    percent_ext: number; // 涨跌幅（扩展精度）
    delayed: number; // 延迟标识
    type: number; // 股票类型
    tick_size: number; // 最小变动单位
    float_shares: number | null; // 流通股数
    high: number; // 当日最高价
    float_market_capital: number | null; // 流通市值
    timestamp_ext: number; // 时间戳（扩展精度）
    lot_size: number; // 每手股数
    lock_set: number; // 锁定标识
    chg: number; // 涨跌额
    eps: number; // 每股收益
    last_close: number; // 昨日收盘价
    profit_four: number; // 四季度净利润
    volume: number; // 成交量
    volume_ratio: number; // 量比
    profit_forecast: number; // 预测净利润
    turnover_rate: number; // 换手率
    low52w: number; // 52 周最低价
    name: string; // 股票名称
    exchange: string; // 交易所
    pe_forecast: number; // 预测市盈率
    total_shares: number; // 总股本
    status: number; // 股票状态
    code: string; // 股票代码
    goodwill_in_net_assets: number; // 商誉占净资产比例
    avg_price: number; // 平均价格
    percent: number; // 涨跌幅
    psr: number; // 市销率
    amplitude: number; // 振幅
    current: number; // 当前价格
    current_year_percent: number; // 年初至今涨跌幅
    issue_date: number; // 上市日期（时间戳）
    sub_type: string; // 子类型
    low: number; // 当日最低价
    market_capital: number; // 总市值
    shareholder_funds: number; // 股东权益
    dividend: number | null; // 股息
    dividend_yield: number | null; // 股息率
    currency: string; // 货币单位
    chg_ext: number; // 涨跌额（扩展精度）
    navps: number; // 每股净资产
    profit: number; // 净利润
    beta: number | null; // 贝塔系数
    timestamp: number; // 时间戳
    pe_lyr: number; // 静态市盈率
    amount: number; // 成交额
    pledge_ratio: number | null; // 质押比例
    short_ratio: number | null; // 做空比例
    inst_hld: number | null; // 机构持股比例
    pb: number; // 市净率
    pe_ttm: number; // 滚动市盈率
    contract_size: number; // 合约单位
    variable_tick_size: string; // 可变最小变动单位
    time: number; // 时间（时间戳）
    open: number; // 开盘价
}

interface Others {
    pankou_ratio: number; // 盘口比例
    cyb_switch: boolean; // 创业板标识
}

interface Tag {
    description: string; // 标签描述
    value: number; // 标签值
}

interface StockData {
    data: {
        market: Market; // 市场相关信息
        quote: Quote; // 股票报价信息
        others: Others; // 其他信息
        tags: Tag[]; // 标签信息
    };
    error_code: number; // 错误代码
    error_description: string; // 错误描述
}

const STOCK_API_URL = 'https://stock.xueqiu.com/v5/stock/quote.json' // Replace with your actual API URL
const SUGGESTION_API_URL = 'https://xueqiu.com/query/v1/suggest_stock.json' // Replace with your actual API URL
// 读取环境变量
let Cookie = '';
let cookieTimestamp = 0;
const COOKIE_EXPIRATION_TIME = 1 * 24 * 60 * 60 * 1000; // 2天

export async function getToken(): Promise<string> {
    const now = Date.now();
    if (Cookie && (now - cookieTimestamp) < COOKIE_EXPIRATION_TIME) {
        return Cookie;
    }
    const cookieKey = 'xq_a_token';

    try {
        // 先请求第一个 URL
        const res1 = await axios.get('https://xueqiu.com/about');
        Cookie = res1.headers['set-cookie']?.find(c => c.includes(cookieKey))?.split(';')[0];
        if (!Cookie) {
            throw new Error(`Failed to get ${cookieKey} cookie.`);
        }
        cookieTimestamp = now; // 记录获取 Cookie 的时间
        return Cookie;
    } catch (error) {
        console.error('Error getting cookie:', error);
        throw error;
    }
}

// https://xueqiu.com/query/v1/suggest_stock.json?q=gzmt
export async function getSuggestStock(q: string) {

    const response = await axios.get<StockData>(SUGGESTION_API_URL, {
        params: {
            q,
        },
        headers: {
            Cookie: await getToken()
        },
    })

    if (response.status === 200)
        return response.data?.data?.[0]?.code
}

async function retryWithNewToken<T>(fetchFunction: () => Promise<T>): Promise<T> {
    try {
        return await fetchFunction();
    } catch (error) {
        // 重新获取 Cookie 并重试
        Cookie = '';
        cookieTimestamp = 0;
        try {
            return await fetchFunction();
        } catch (retryError) {
            throw new Error(`Failed after retry: ${retryError.message}`);
        }
    }
}
export async function getStockBasicData(symbol: string): Promise<StockData['data']> {
    try {
        symbol = await getSuggestStock(symbol);

        if (!symbol) throw new Error('未找到相关股票');

        const fetchStockData = async () => {
            const response = await axios.get<StockData>(STOCK_API_URL, {
                params: {
                    symbol,
                    extend: 'detail'
                },
                headers: {
                    Cookie: await getToken(),
                },
            });
            if (response.status === 200 && response?.data?.data?.quote) {
                return response.data.data;
            } else {
                throw new Error(`Failed to fetch stock data for ${symbol}: ${response.status}`);
            }
        };

        return await retryWithNewToken(fetchStockData);
    } catch (error) {
        throw error;
    }
}

// 新增辅助函数用于并行获取多个股票数据
async function getMultipleStocksData(symbols: string[]): Promise<string[]> {
    const promises = symbols.map(async (symbol) => {
        try {
            const { quote, market } = await getStockBasicData(symbol);
            const isGrowing = quote.percent > 0;
            const trend = isGrowing ? '📈' : '📉';
            let text = `${quote?.name}(${quote?.symbol}): ${quote.current} (${trend}${isGrowing ? '+' : ''}${convertToNumber(quote.percent)}%)`;

            if (quote.current_ext && quote.percent_ext && quote.current !== quote.current_ext && market.status_id !== 5) {
                const preIsGrowing = quote.percent_ext > 0;
                const preTrend = preIsGrowing ? '📈' : '📉';
                text += `\n${market.status}：${quote.current_ext} （${preTrend}${preIsGrowing ? '+' : ''}${convertToNumber(quote.percent_ext)}%）`;
            }
            return text;
        } catch (error) {
            return `获取 ${symbol} 失败：${error.message}`;
        }
    });
    return await Promise.all(promises);
}

export async function getStockData(symbol: string): Promise<string> {
    try {
        const symbols = symbol.split(/\s+/);  // 按空格分割多个股票代码
        const results = await retryWithNewToken(() => getMultipleStocksData(symbols));
        return results.join('\n\n');  // 用1个换行符分隔每个股票的数据
    } catch (error) {
        return `获取 ${symbol} 失败：${error.message}`;
    }
}

// 定义时间段权重映射
const TIME_WEIGHTS = new Map<string, number>([
    // 开盘前10分钟，按分钟记录权重（这些数值是根据每分钟的成交量增长率计算得出）
    ['9:30', 8.48], // 87 -> 453 (增长最快)
    ['9:31', 8.48], // 453 -> 691
    ['9:32', 6.47], // 691 -> 872
    ['9:33', 5.44], // 872 -> 1062
    ['9:34', 4.97], // 1062 -> 1254
    ['9:35', 6.69], // 1254 -> 1443
    ['9:36', 4.50], // 1443 -> 1630
    ['9:37', 4.36], // 1630 -> 1788
    ['9:38', 4.18], // 1788 -> 1935
    ['9:39', 4.02], // 1935 -> 2056
    
    // 后续按10分钟区间设置权重（基于每10分钟的平均增长率）
    ['9:40-9:50', 3.85],  // 2056 -> 3180
    ['9:50-10:00', 2.98], // 3180 -> 4108
    ['10:00-10:10', 2.56], // 4108 -> 4755
    ['10:10-10:20', 2.23], // 4755 -> 5257
    ['10:20-10:30', 1.97], // 5257 -> 5826
    ['10:30-10:40', 1.82], // 5826 -> 6268
    ['10:40-10:50', 1.68], // 6268 -> 6567
    ['10:50-11:00', 1.54], // 6567 -> 6812
    ['11:00-11:10', 1.42], // 6812 -> 7046
    ['11:10-11:20', 1.32], // 7046 -> 7267
    ['11:20-11:30', 1.24], // 7267 -> 7534
    ['13:00-13:10', 1.18], // 7534 -> 7910
    ['13:10-13:20', 1.14], // 7910 -> 8247
    ['13:20-13:30', 1.1], // 8247 -> 8544
    ['13:30-13:40', 1.07], // 8544 -> 8852
    ['13:40-13:50', 1.04], // 8852 -> 9162
    ['13:50-14:00', 1.01], // 9162 -> 9645
    ['14:00-14:10', 1.0], // 9645 -> 10123
    ['14:10-14:20', 1.0], // 10123 -> 10661
    ['14:20-14:30', 1.0], // 10661 -> 11102
    ['14:30-14:40', 0.99], // 11102 -> 11549
    ['14:40-14:50', 1.98], // 11549 -> 12066
    ['14:50-15:00', 1.0], // 12066 -> 12821 (收盘前放量)
]);

function getTimeKey(hour: number, minute: number): string {
    // 开盘前10分钟按分钟返回
    if (hour === 9 && minute >= 30 && minute < 40) {
        return `${hour}:${minute}`;
    }
    
    // 其他时间按10分钟区间返回
    const startMinute = Math.floor(minute / 10) * 10;
    const endMinute = startMinute + 10;
    return `${hour}:${startMinute}-${hour}:${endMinute}`;
}

function calculateTradingMinutes(now: Date): { minutes: number; weight: number } {
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;

    // 如果在开盘前或收盘后，返回0
    if (currentMinutes < 9 * 60 + 30 || currentMinutes > 15 * 60) 
        return { minutes: 0, weight: 1 };

    let tradingMinutes = 0;
    
    // 获取当前时间段的权重
    const timeKey = getTimeKey(hour, minute);
    const weight = TIME_WEIGHTS.get(timeKey) || 1.0;

    // 计算交易分钟数
    if (currentMinutes <= 11 * 60 + 30) {
        tradingMinutes = Math.max(0, currentMinutes - (9 * 60 + 30));
    } else if (currentMinutes >= 13 * 60) {
        tradingMinutes = 120 + Math.min(120, currentMinutes - 13 * 60);
    } else {
        tradingMinutes = 120;
    }

    return { minutes: tradingMinutes, weight };
}

export async function getMarketIndexData() {
    try {
        const [shData, szData] = await Promise.all([
            getStockBasicData('SH000001'),
            getStockBasicData('SZ399001')
        ]);

        const now = new Date();
        const { minutes: tradingMinutes, weight } = calculateTradingMinutes(now);
        const totalMinutesPerDay = 4 * 60; // 4小时交易时间
        
        // 计算当前两市成交额
        const currentAmount = shData.quote.amount + szData.quote.amount;
        
        // 如果已收盘或未开盘，直接显示实际成交额，否则显示预估值
        const estimatedAmount = tradingMinutes === 0 
            ? currentAmount 
            : (currentAmount / (tradingMinutes * weight)) * totalMinutesPerDay;

        // 处理上证指数数据
        const shQuote = shData.quote;
        const shIsGrowing = shQuote.percent > 0;
        const shTrend = shIsGrowing ? '📈' : '📉';

        // 处理深证指数数据
        const szQuote = szData.quote;
        const szIsGrowing = szQuote.percent > 0;
        const szTrend = szIsGrowing ? '📈' : '📉';

        let text = `${shQuote?.name}(${shQuote?.symbol}) `;
        text += `现价：${shQuote.current} ${shTrend}(${shIsGrowing ? '+' : ''}${convertToNumber(shQuote.percent)}%)\n`;
        text += `两市成交额：${formatAmount(currentAmount)}`;
        // 只在交易时段显示预估值
        if (tradingMinutes > 0) {
            text += `\n预估全天：${formatAmount(estimatedAmount)}`;
        }

        return text;
    } catch (error) {
        return `获取市场指数失败：${error.message}`;
    }
}

export async function getStockDetailData(symbol: string): Promise<string> {
    try {
        const { quote } = await getStockBasicData(symbol);
        const isGrowing = quote.percent > 0;
        const trend = isGrowing ? '📈' : '📉';

        let text = `${quote?.name}(${quote?.symbol})\n`;
        text += `现价：${quote.current} ${trend}${isGrowing ? '+' : ''}${convertToNumber(quote.percent)}%\n`;
        text += `振幅：${convertToNumber(quote.amplitude)}%\n`;
        text += `成交均价：${convertToNumber(quote.avg_price)}\n`;
        text += `成交额：${formatAmount(quote.amount)}\n`;
        text += `成交量：${formatAmount(quote.volume)}手\n`;
        text += `换手率：${convertToNumber(quote.turnover_rate)}%\n`;
        text += `总市值：${formatAmount(quote.market_capital)}\n`;
        text += `年初至今：${quote.current_year_percent > 0 ? '+' : ''}${convertToNumber(quote.current_year_percent)}%\n`;
        text += `市盈率TTM：${convertToNumber(quote.pe_ttm || 0)}\n`;
        text += `市净率：${convertToNumber(quote.pb || 0)}`;

        if (quote.dividend_yield) {
            text += `\n股息率：${convertToNumber(quote.dividend_yield)}%`;
        }

        return text;
    } catch (error) {
        return `获取 ${symbol} 详情失败：${error.message}`;
    }
}

