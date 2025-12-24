import { Market, HistoryPoint } from '../types';

// --- CONFIGURATION ---
// Dome API Configuration
const DOME_BASE_URL = 'https://api.domeapi.io/v1/polymarket';
const DOME_API_KEY = '32a23ed6f5e3bb12af51a76e42f2f72f15965b63';

// Polymarket CLOB Websocket
const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

// --- WEBSOCKET MANAGER ---
type PriceUpdateCallback = (assetId: string, price: number) => void;
type ConnectionStatusCallback = (isConnected: boolean) => void;

class LivePriceManager {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, PriceUpdateCallback> = new Map();
  private statusListeners: Set<ConnectionStatusCallback> = new Set();
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
      this.notifyStatus(true);
      this.flushPendingSubscriptions();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
      this.notifyStatus(false);
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
    // If asks are empty, fallback to last_trade_price or 0
    let price = 0;
    if (data.asks && data.asks.length > 0) {
      price = Number(data.asks[0].price);
    } else if (data.last_trade_price) {
      price = Number(data.last_trade_price);
    }

    if (price > 0) {
      this.subscribers.forEach((cb) => cb(data.asset_id, price));
    }
  }

  public subscribe(assetIds: string[], callback: PriceUpdateCallback) {
    if (assetIds.length === 0) return;

    if (!this.ws) {
      this.connect();
    }

    this.subscribers.set('global_listener', callback);
    assetIds.forEach(id => this.pendingSubscriptions.add(id));

    if (this.isConnected) {
      this.flushPendingSubscriptions();
    }
  }

  public onStatusChange(callback: ConnectionStatusCallback) {
    this.statusListeners.add(callback);
    // Immediate callback with current state
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(status: boolean) {
    this.statusListeners.forEach(cb => cb(status));
  }

  private flushPendingSubscriptions() {
    if (this.pendingSubscriptions.size === 0 || !this.ws) return;

    const assets = Array.from(this.pendingSubscriptions);
    
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
 * Fetcher using Dome API with Authentication
 */
const fetchFromDome = async (endpoint: string, params: URLSearchParams = new URLSearchParams()): Promise<any> => {
  const url = `${DOME_BASE_URL}${endpoint}?${params.toString()}`;
  
  try {
    const res = await fetch(url, { 
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${DOME_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Dome API Error ${res.status}: ${errText}`);
    }
    
    return await res.json();
  } catch (e: any) {
    console.warn(`Dome API connection failed for ${endpoint}:`, e);
    throw e;
  }
};

/**
 * Transforms a raw API Market object (from Dome Spec) into our App's Market interface.
 */
const transformMarket = (m: any): Market => {
  const tokens: any[] = [];

  // Try to find a last trade price if available in raw data (Dome sometimes provides this)
  // Otherwise default to 0 and wait for socket.
  // Note: m.last_trade_price might exist on some endpoints
  const initialPrice = m.last_trade_price ? Number(m.last_trade_price) : 0;

  // Parse Outcomes
  if (m.side_a) {
    tokens.push({
      tokenId: m.side_a.id, // CLOB Token ID
      clobTokenId: m.side_a.id,
      outcome: m.side_a.label,
      price: initialPrice, 
      winner: m.winning_side === 'side_a'
    });
  }

  if (m.side_b) {
    tokens.push({
      tokenId: m.side_b.id,
      clobTokenId: m.side_b.id,
      outcome: m.side_b.label,
      price: initialPrice, // This is an approximation until socket connects
      winner: m.winning_side === 'side_b'
    });
  }

  // Fallback if tokens empty (shouldn't happen for valid markets but safe)
  if (tokens.length === 0) {
      tokens.push({ tokenId: 'unknown', clobTokenId: '', outcome: 'Unknown', price: 0, winner: false });
  }

  // Weekly volume is often provided by Dome/Poly APIs. We use it to estimate "Trending" status.
  const volumeWeekly = Number(m.volume_1_week || 0);
  const volume24h = volumeWeekly > 0 ? volumeWeekly / 7 : 0;

  return {
    id: m.condition_id, // Use condition_id as unique ID
    question: m.title,
    conditionId: m.condition_id,
    slug: m.market_slug,
    resolutionSource: m.resolution_source || '',
    endDate: m.end_time ? new Date(m.end_time * 1000).toISOString() : '',
    creationDate: m.start_time ? new Date(m.start_time * 1000).toISOString() : '',
    image: m.image,
    icon: m.image, 
    active: m.status === 'open',
    closed: m.status === 'closed',
    archived: false,
    new: false,
    featured: volume24h > 100000, 
    restricted: false,
    groupItemTitle: '',
    description: m.description || m.title,
    tags: m.tags || [],
    tokens: tokens,
    rewards: null,
    volume: Number(m.volume_total || 0),
    volume24hr: volume24h, 
    liquidity: Number(m.liquidity || 0), // If available
    outcomes: tokens.map(t => t.outcome),
    outcomePrices: tokens.map(t => String(t.price)),
    clobTokenIds: tokens.map(t => t.clobTokenId),
  };
};

export const getMarkets = async (
  tag: string | null = null, 
  limit: number = 50, 
  offset: number = 0
): Promise<Market[]> => {
  try {
    // --- ALGORITHM SETTINGS ---
    // To show "Real" markets, we need aggressive filtering.
    // 50k Volume min for trending to avoid dead markets.
    // 1k Volume min for New/Others.
    let minVolume = '50000'; 
    
    if (tag === 'new') {
        minVolume = '1000';
    } else if (tag && tag !== 'trending' && tag !== 'all') {
        // Specific categories can have slightly lower threshold to ensure we fill the page
        minVolume = '10000';
    }

    const params = new URLSearchParams({
      limit: '100', // Fetch more to allow client-side filtering/sorting
      offset: offset.toString(),
      status: 'open',
      min_volume: minVolume,
    });

    // Special handling for "New" markets
    if (tag === 'new') {
        // Calculate timestamp for 7 days ago
        const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
        params.append('start_time', oneWeekAgo.toString());
    } else if (tag && tag !== 'all' && tag !== 'trending') {
        params.append('tags', tag);
    }

    const data = await fetchFromDome('/markets', params);
    
    const items = data.markets || [];

    if (!Array.isArray(items)) {
      console.warn("Data.markets is not an array:", data);
      return [];
    }

    let markets = items
      .filter((m: any) => m && m.condition_id && m.title)
      .map(transformMarket);

    // --- CLIENT SIDE "TRENDING" ALGORITHM ---
    
    // 1. Sort by 24h Volume (proxy for Activity)
    markets.sort((a, b) => b.volume24hr - a.volume24hr);

    // 2. Filter out "Boring" markets (Extreme odds + Low Volume)
    // If a market is 99% vs 1%, it's boring unless it has HUGE volume (e.g. > $1M 24h)
    // We assume initial price is 0, so we skip this check if price isn't loaded yet,
    // relying on the initial Volume filter to keep quality up.
    
    return markets.slice(0, limit);

  } catch (error) {
    console.error("Critical: Failed to fetch markets from Dome API.", error);
    throw error;
  }
};

export const getMarket = async (id: string): Promise<Market | null> => {
  try {
    const params = new URLSearchParams({
        condition_id: id,
        limit: '1'
    });
    
    const data = await fetchFromDome('/markets', params);
    const items = data.markets || [];
    
    if (items.length > 0) {
        return transformMarket(items[0]);
    }
    return null;

  } catch (error) {
    console.error(`Failed to fetch market ${id}`, error);
    return null;
  }
}

export const getMarketHistory = async (clobTokenId: string): Promise<HistoryPoint[]> => {
  if (!clobTokenId || clobTokenId === 'undefined' || clobTokenId === 'null') {
      return [];
  }

  try {
    const directUrl = `https://clob.polymarket.com/prices-history?interval=1h&market=${clobTokenId}&fidelity=60`;
    const res = await fetch(directUrl);
    if(res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history)) {
            return data.history.map((point: any) => ({
                t: point.t,
                p: Number(point.p)
            }));
        }
    }
    return [];
  } catch (e) {
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
  if (val === 0) return '---';
  return `${(val * 100).toFixed(0)}%`;
};

export const formatCents = (val: number) => {
  return `${(val * 100).toFixed(1)}¢`;
};