import { Market, HistoryPoint } from '../types';

// --- CONFIGURATION ---
const BASE_URL = 'https://gamma-api.polymarket.com';
const CLOB_API_URL = 'https://clob.polymarket.com';
const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

// --- WEBSOCKET MANAGER ---
type PriceUpdateCallback = (assetId: string, price: number) => void;

class LivePriceManager {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, PriceUpdateCallback> = new Map();
  private pendingSubscriptions: Set<string> = new Set();
  private isConnected: boolean = false;
  private heartbeatInterval: any = null;

  constructor() {
    // Lazy initialization happens on first subscribe
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('>> CLOB_SOCKET_ESTABLISHED');
      this.isConnected = true;
      this.flushPendingSubscriptions();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle snapshot or update
        // Polymarket CLOB sends: { event_type: "book", asset_id: "...", asks: [], bids: [] }
        // We use the Best Ask as the "Buy Yes" price.
        if (Array.isArray(data)) {
            data.forEach(item => this.processUpdate(item));
        } else {
            this.processUpdate(data);
        }
      } catch (e) {
        // Ignore parse errors (ping/pong)
      }
    };

    this.ws.onerror = (e) => {
      console.warn('>> CLOB_SOCKET_ERROR', e);
    };

    this.ws.onclose = () => {
      console.log('>> CLOB_SOCKET_CLOSED');
      this.isConnected = false;
      this.stopHeartbeat();
      // Reconnect after delay
      setTimeout(() => this.connect(), 5000);
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify("ping"));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  private processUpdate(data: any) {
    if (!data || !data.asset_id) return;
    
    // We look at 'asks' because if I want to buy 'Yes', I take the lowest ask.
    // asks format: [ ["price", "size"], ... ] sorted ascending by price
    if (data.asks && data.asks.length > 0) {
      const bestAsk = Number(data.asks[0].price);
      // Callback to UI
      this.subscribers.forEach((cb) => cb(data.asset_id, bestAsk));
    }
  }

  public subscribe(assetIds: string[], callback: PriceUpdateCallback) {
    if (assetIds.length === 0) return;

    if (!this.ws) {
      this.connect();
    }

    // Register callback (simple broadcase model for this demo)
    this.subscribers.set('global_listener', callback);

    // Queue subs
    assetIds.forEach(id => this.pendingSubscriptions.add(id));

    if (this.isConnected) {
      this.flushPendingSubscriptions();
    }
  }

  private flushPendingSubscriptions() {
    if (this.pendingSubscriptions.size === 0 || !this.ws) return;

    const assets = Array.from(this.pendingSubscriptions);
    
    // Polymarket accepts array of asset_ids
    const msg = {
      assets_ids: assets,
      type: "market"
    };

    this.ws.send(JSON.stringify(msg));
    this.pendingSubscriptions.clear();
  }
}

export const livePriceManager = new LivePriceManager();

// --- HTTP FETCHERS ---

/**
 * Robust fetcher that parses JSON safely.
 * Handles the specific wrapper format of proxies like AllOrigins.
 */
const fetchJsonWithRetry = async (targetUrl: string, options: RequestInit = {}): Promise<any> => {
  // 1. Attempt Direct Connection (Preferred)
  try {
    const res = await fetch(targetUrl, { ...options, headers: { 'Accept': 'application/json', ...options.headers } });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Direct fetch failed, switching to proxy matrix...", e);
  }

  // 2. Attempt AllOrigins (Reliable JSON Proxy)
  // Note: AllOrigins returns { contents: "stringified_json", status: ... }
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    const wrapper = await res.json();
    
    if (wrapper && wrapper.contents) {
      // The actual data is a string inside 'contents'
      return JSON.parse(wrapper.contents);
    }
  } catch (e) {
    console.warn("AllOrigins proxy failed.", e);
  }
  
  // 3. Attempt CodeTabs (Raw Proxy)
  try {
     const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
     const res = await fetch(proxyUrl);
     if (res.ok) return await res.json();
  } catch (e) {
     console.warn("CodeTabs proxy failed.", e);
  }

  throw new Error("All data nodes unreachable. Network firewall or CORS blocking active.");
};

const transformEvent = (event: any): Market => {
  const markets = event.markets || [];

  const tokens = markets.map((m: any) => {
    // --- 1. ID EXTRACTION ---
    let assetId = m.clobTokenId || m.asset_id || m.tokenId || m.token_id;
    
    // Fallback: Convert decimal token_id to Hex if needed for History API
    if ((!assetId || !assetId.startsWith('0x')) && m.token_id) {
       try {
         assetId = BigInt(m.token_id).toString(16);
       } catch (e) { /* ignore */ }
    }

    // --- 2. PRICE EXTRACTION ---
    // Gamma API structure varies. We check multiple fields.
    const rawPrice = m.price 
      ?? m.outcomePrice 
      ?? m.lastTradePrice 
      ?? m.last_trade_price 
      ?? m.best_ask 
      ?? m.stats?.price
      ?? 0;

    return {
      tokenId: m.token_id || m.tokenId,
      clobTokenId: assetId,
      outcome: m.groupItemTitle || m.outcome || 'Yes',
      price: Number(rawPrice),
      winner: m.winner
    };
  });

  // Sort: Highest price/probability first
  tokens.sort((a: any, b: any) => b.price - a.price);

  // --- 3. VOLUME SUMMATION ---
  let vol24 = Number(event.volume_24hr || event.volume24hr || 0);
  let totalVol = Number(event.volume || 0);
  let liquidity = Number(event.liquidity || 0);

  if (markets.length > 0) {
      if (vol24 === 0) vol24 = markets.reduce((acc: number, m: any) => acc + Number(m.volume_24hr || 0), 0);
      if (totalVol === 0) totalVol = markets.reduce((acc: number, m: any) => acc + Number(m.volume || 0), 0);
      if (liquidity === 0) liquidity = markets.reduce((acc: number, m: any) => acc + Number(m.liquidity || 0), 0);
  }

  return {
    id: event.id,
    question: event.title,
    conditionId: event.condition_id,
    slug: event.slug,
    resolutionSource: event.resolution_source || '',
    endDate: event.end_date,
    creationDate: event.creation_date,
    image: event.image,
    icon: event.icon,
    active: event.active,
    closed: event.closed,
    archived: event.archived || false,
    new: event.new || false,
    featured: event.featured || false,
    restricted: event.restricted || false,
    groupItemTitle: event.groupItemTitle || '',
    description: event.description,
    tags: event.tags ? event.tags.map((t: any) => t.slug) : [],
    tokens: tokens,
    rewards: event.rewards || null,
    volume: totalVol,
    volume24hr: vol24,
    liquidity: liquidity,
    outcomes: tokens.map((t: any) => t.outcome),
    outcomePrices: tokens.map((t: any) => String(t.price)),
    clobTokenIds: tokens.map((t: any) => t.clobTokenId),
  };
};

export const getMarkets = async (
  tag: string | null = null, 
  limit: number = 50, 
  offset: number = 0
): Promise<Market[]> => {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      active: 'true',
      closed: 'false',
      order: 'volume', 
      ascending: 'false',
    });

    if (tag) params.append('tag_slug', tag);
    params.append('_t', Date.now().toString()); // Cache buster

    const fullUrl = `${BASE_URL}/events?${params.toString()}`;
    
    // Use the robust fetcher
    const data = await fetchJsonWithRetry(fullUrl);
    
    if (!Array.isArray(data)) {
      console.warn("Data received but not an array:", data);
      return [];
    }

    return data
      .filter((e: any) => e && e.id && e.markets && Array.isArray(e.markets))
      .map(transformEvent);

  } catch (error) {
    console.error("Critical: Failed to fetch markets.", error);
    throw error;
  }
};

export const getMarket = async (id: string): Promise<Market | null> => {
  try {
    const fullUrl = `${BASE_URL}/events/${id}`;
    const data = await fetchJsonWithRetry(fullUrl);
    return transformEvent(data);
  } catch (error) {
    console.error(`Failed to fetch market ${id}`, error);
    return null;
  }
}

export const getMarketHistory = async (clobTokenId: string): Promise<HistoryPoint[]> => {
  // Validation
  if (!clobTokenId || clobTokenId === 'undefined' || clobTokenId === 'null') {
      return [];
  }

  try {
    const fullUrl = `${CLOB_API_URL}/prices-history?interval=1h&market=${clobTokenId}&fidelity=60`;
    
    // Use robust fetcher
    const data = await fetchJsonWithRetry(fullUrl);
    
    if (data.history && Array.isArray(data.history)) {
      return data.history.map((point: any) => ({
        t: point.t,
        p: Number(point.p)
      }));
    }
    return [];
  } catch (e) {
    // Fail silently for history to not disrupt UI
    return [];
  }
};

// --- FORMATTERS ---
export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatNumber = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(val);
};

export const formatPercentage = (val: number) => {
  return `${(val * 100).toFixed(0)}%`;
};

export const formatCents = (val: number) => {
  return `${(val * 100).toFixed(1)}¢`;
};