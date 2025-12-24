import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, TrendingUp, Zap, Skull, DollarSign, Globe, Lock, Search, BarChart3, Filter, ShieldAlert, Cpu, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Hash, Radio, ArrowUp, ArrowDown } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MatrixRain from './components/MatrixRain';
import GlitchText from './components/GlitchText';
import { Market, Category, HistoryPoint } from './types';
import { getMarkets, getMarket, getMarketHistory, livePriceManager, formatCurrency, formatNumber, formatPercentage, formatCents } from './services/polymarketService';

// --- Types & Constants ---
type ViewState = 'LANDING' | 'DASHBOARD';

// Enhanced Categories to match Polymarket
const CATEGORIES: Category[] = [
  { id: 'trending', label: 'TRENDING', apiTag: null }, // Default high volume
  { id: 'new', label: 'NEW', apiTag: 'new' }, // Logic handled in service
  { id: 'politics', label: 'POLITICS', apiTag: 'politics' },
  { id: 'crypto', label: 'CRYPTO', apiTag: 'crypto' },
  { id: 'sports', label: 'SPORTS', apiTag: 'sports' },
  { id: 'business', label: 'BUSINESS', apiTag: 'business' },
  { id: 'science', label: 'SCIENCE', apiTag: 'science' },
  { id: 'culture', label: 'CULTURE', apiTag: 'pop culture' },
];

// --- Live Value Component ---
const LiveValue: React.FC<{ value: number; formatter: (v: number) => string; className?: string }> = ({ value, formatter, className = "" }) => {
  const [prevValue, setPrevValue] = useState(value);
  const [flash, setFlash] = useState<'green' | 'red' | null>(null);

  useEffect(() => {
    // Only flash if the change is significant (not float noise)
    const diff = value - prevValue;
    if (Math.abs(diff) > 0.00001) {
      if (value > prevValue) {
        setFlash('green');
      } else if (value < prevValue) {
        setFlash('red');
      }
      const timeout = setTimeout(() => setFlash(null), 1000);
      return () => clearTimeout(timeout);
    }
    setPrevValue(value);
  }, [value]);

  const isZero = value === 0;

  return (
    <span className={`transition-colors duration-500 ${isZero ? 'text-gray-600' : ''} ${flash === 'green' ? 'text-matrix-green text-shadow-green' : flash === 'red' ? 'text-red-500 text-shadow-red' : className}`}>
      {formatter(value)}
    </span>
  );
};

// --- Landing Page Component ---
const LandingPage: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-mono z-50">
      <MatrixRain opacity={0.3} />
      
      <div className="z-10 flex flex-col items-center space-y-8 p-4 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl md:text-8xl font-black text-matrix-green tracking-tighter drop-shadow-[0_0_15px_rgba(0,255,65,0.8)] animate-pulse">
            POLY<span className="text-white">SCREENER</span>
          </h1>
          <p className="text-matrix-dim text-sm md:text-xl tracking-[0.2em] uppercase typing-effect border-r-2 border-matrix-green pr-2">
            Advanced Alpha Terminal
          </p>
        </div>

        <div className="border border-matrix-green/50 bg-black/80 p-6 max-w-lg w-full backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,65,0.1)]">
          <div className="flex flex-col space-y-4 text-left text-xs md:text-sm text-green-400 font-tech">
            <p>{'>'} CONNECTING TO CLOB NODES...</p>
            <p>{'>'} PARSING EVENT CONTRACTS...</p>
            <p>{'>'} CALCULATING IMPLIED PROBABILITIES...</p>
            <p className="text-white animate-pulse">{'>'} SYSTEM READY.</p>
          </div>
        </div>

        <button 
          onClick={onEnter}
          className="group relative px-8 py-4 bg-transparent overflow-hidden border border-matrix-green text-matrix-green font-bold text-xl uppercase tracking-widest hover:bg-matrix-green hover:text-black transition-all duration-200 shadow-[0_0_20px_rgba(0,255,65,0.4)] hover:shadow-[0_0_50px_rgba(0,255,65,0.8)]"
        >
          <span className="relative z-10 flex items-center gap-2">
            <Terminal size={20} /> LAUNCH TERMINAL
          </span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </div>
    </div>
  );
};

// --- Market Row Component ---
const MarketRow: React.FC<{
  initialMarket: Market;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ initialMarket, isExpanded, onToggle }) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Use the market passed in props, which might be updated by parent's live feed
  const market = initialMarket;

  useEffect(() => {
    if (isExpanded && history.length === 0) {
      setLoadingHistory(true);
      // Fetch history for the most liquid token (usually the first one or the one with highest price if we want trend)
      const tokenId = market.clobTokenIds[0];
      if (tokenId) {
        getMarketHistory(tokenId).then(data => {
            setHistory(data);
            setLoadingHistory(false);
        });
      } else {
        setLoadingHistory(false);
      }
    }
  }, [isExpanded, market.clobTokenIds]);

  const topOutcome = market.tokens.reduce((prev, current) => (prev.price > current.price) ? prev : current, market.tokens[0] || { price: 0, outcome: 'N/A' });

  return (
    <div className={`group transition-all duration-300 ${isExpanded ? 'bg-matrix-green/5' : 'hover:bg-white/5'}`}>
      <div
        onClick={onToggle}
        className="grid grid-cols-12 gap-4 p-4 cursor-pointer items-center"
      >
        <div className="col-span-12 md:col-span-5 flex items-start gap-3">
            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${market.active ? 'bg-matrix-green shadow-[0_0_5px_#00ff41]' : 'bg-gray-600'}`}></div>
            <div>
                <div className="text-white text-sm font-bold leading-tight group-hover:text-matrix-green transition-colors">
                  {market.question}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                    {market.featured && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded border border-yellow-500/50">FEATURED</span>}
                    {market.new && <span className="text-[10px] bg-blue-500/20 text-blue-500 px-1 rounded border border-blue-500/50">NEW</span>}
                    <span className="text-[10px] text-gray-500 font-mono">ID: {market.id.substring(0,8)}...</span>
                </div>
            </div>
        </div>

        <div className="hidden md:block col-span-2 text-right">
             <div className="text-sm font-bold text-white">{topOutcome?.outcome}</div>
             <div className="text-xs font-mono">
                <LiveValue value={topOutcome?.price || 0} formatter={formatPercentage} />
             </div>
        </div>

        <div className="hidden md:block col-span-2 text-right font-mono">
             <div className="text-xs text-white">${formatNumber(market.volume24hr)}</div>
        </div>

        <div className="hidden md:block col-span-2 text-right text-xs text-matrix-dim font-mono">
             {market.endDate ? new Date(market.endDate).toLocaleDateString() : '---'}
        </div>

        <div className="hidden md:block col-span-1 text-center">
            {isExpanded ? <ChevronUp size={16} className="mx-auto text-matrix-green"/> : <ChevronDown size={16} className="mx-auto text-gray-600 group-hover:text-white"/>}
        </div>
      </div>

      {/* Expanded Detail View */}
      {isExpanded && (
        <div className="border-t border-matrix-dim/30 bg-black/40 p-6 animate-in slide-in-from-top-2 duration-200">
           <div className="flex flex-col lg:flex-row gap-8">
               <div className="flex-1 space-y-4">
                  <div className="h-64 w-full bg-black/50 border border-matrix-dim/30 relative rounded overflow-hidden">
                      {loadingHistory ? (
                          <div className="absolute inset-0 flex items-center justify-center text-matrix-green text-xs animate-pulse">LOADING CHART DATA...</div>
                      ) : history.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#00ff41" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="t" hide />
                                <YAxis domain={['auto', 'auto']} hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #00ff41', color: '#00ff41', fontFamily: 'monospace' }}
                                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Probability']}
                                    labelFormatter={() => ''}
                                />
                                <Area type="monotone" dataKey="p" stroke="#00ff41" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                            </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">NO HISTORICAL DATA AVAILABLE</div>
                      )}
                  </div>
                  <div className="text-xs text-gray-400 font-mono leading-relaxed max-h-40 overflow-y-auto custom-scrollbar p-2 border border-white/5 bg-black">
                      {market.description}
                  </div>
               </div>

               <div className="w-full lg:w-80 shrink-0 space-y-4">
                  <h4 className="text-xs font-bold text-matrix-green uppercase border-b border-matrix-dim pb-2">Outcome Probabilities</h4>
                  <div className="space-y-2">
                      {market.tokens.map(token => (
                          <div key={token.tokenId} className="flex justify-between items-center p-2 bg-white/5 border border-white/10 hover:border-matrix-green/50 transition-colors">
                              <span className="text-sm text-white font-medium truncate max-w-[140px]" title={token.outcome}>{token.outcome}</span>
                              <div className="text-right">
                                  <LiveValue value={token.price} formatter={formatPercentage} className="font-bold text-matrix-green font-mono" />
                                  <div className="text-[10px] text-gray-500">
                                      ID: {token.tokenId.substring(0,4)}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  <div className="pt-4 border-t border-matrix-dim/30">
                       <a 
                         href={`https://polymarket.com/market/${market.slug}`} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center justify-center gap-2 w-full py-2 bg-matrix-green text-black font-bold text-sm uppercase hover:bg-white hover:text-black transition-colors"
                       >
                           Trade on Polymarket <ExternalLink size={14}/>
                       </a>
                  </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

// --- Main Application Component ---
const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LANDING');
  const [activeCategory, setActiveCategory] = useState<string>('trending'); // Default to trending/top
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemTime, setSystemTime] = useState(new Date());
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  // Sorting State
  // Changed default key to 'volume24hr'
  const [sortConfig, setSortConfig] = useState<{ key: keyof Market; direction: 'asc' | 'desc' }>({
    key: 'volume24hr', 
    direction: 'desc'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const category = CATEGORIES.find(c => c.id === activeCategory);
      // Fetch more items to ensure we fill the page with high quality ones
      const data = await getMarkets(category?.apiTag, 50); 
      setMarkets(data);
    } catch (e: any) {
      console.error("System Failure:", e);
      setError(e.message || "Failed to establish connection to data node.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'DASHBOARD') {
      fetchData();
      const interval = setInterval(fetchData, 60000); // Refresh list every minute
      return () => clearInterval(interval);
    }
  }, [view, activeCategory]);

  // --- WebSocket Integration ---
  useEffect(() => {
    // 1. Subscribe to connection status
    const cleanupStatus = livePriceManager.onStatusChange((isConnected) => {
      setWsConnected(isConnected);
    });

    // 2. Subscribe to prices when markets are loaded
    if (markets.length > 0) {
      // Extract all CLOB token IDs from the top tokens of displayed markets
      const tokensToSubscribe = markets
        .flatMap(m => m.tokens.slice(0, 2)) // Get top 2 tokens per market
        .map(t => t.clobTokenId)
        .filter(id => id && id.length > 5); // Basic validity check

      if (tokensToSubscribe.length > 0) {
        livePriceManager.subscribe(tokensToSubscribe, (assetId, price) => {
          // Efficient State Update
          setMarkets(prevMarkets => {
            // Find if this assetId exists in our state
            let changed = false;
            const newMarkets = prevMarkets.map(m => {
              const tokenIndex = m.tokens.findIndex(t => t.clobTokenId === assetId);
              if (tokenIndex !== -1) {
                const token = m.tokens[tokenIndex];
                if (Math.abs(token.price - price) > 0.0001) {
                  changed = true;
                  const newTokens = [...m.tokens];
                  newTokens[tokenIndex] = { ...token, price: price };
                  return { ...m, tokens: newTokens };
                }
              }
              return m;
            });
            return changed ? newMarkets : prevMarkets;
          });
        });
      }
    }
    
    return cleanupStatus;
  }, [markets.length]); 

  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSort = (key: keyof Market) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredMarkets = markets.filter(m => 
    m.question.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    
    const valA = a[key];
    const valB = b[key];

    // Handle Dates
    if (key === 'endDate') {
        const dateA = valA ? new Date(valA as string).getTime() : 0;
        const dateB = valB ? new Date(valB as string).getTime() : 0;
        return (dateA - dateB) * dir;
    }

    // Handle Numbers
    if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
    }

    return 0;
  });

  const totalVol = markets.reduce((acc, m) => acc + m.volume, 0);

  if (view === 'LANDING') {
    return <LandingPage onEnter={() => setView('DASHBOARD')} />;
  }

  return (
    <div className="min-h-screen bg-matrix-black text-matrix-green font-mono overflow-x-hidden crt selection:bg-matrix-green selection:text-black">
      <MatrixRain opacity={0.03} />

      {/* --- Header --- */}
      <header className="sticky top-0 z-40 bg-matrix-black/95 border-b border-matrix-dim backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8)]">
        <div className="max-w-[1920px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white font-bold text-2xl tracking-tighter cursor-pointer hover:text-matrix-green transition-colors" onClick={() => setExpandedMarketId(null)}>
              <Terminal className="text-matrix-green" size={24} />
              <span>POLY<span className="text-matrix-green">SCREENER</span></span>
            </div>
            <div className="hidden lg:flex items-center gap-4 text-xs text-matrix-dim border-l border-matrix-dim pl-6 h-8">
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-matrix-green animate-pulse shadow-[0_0_5px_#00ff41]' : 'bg-red-500 animate-pulse'}`}></div> 
                {wsConnected ? 'LIVE FEED CONNECTED' : 'INITIALIZING SOCKET...'}
              </span>
              <span>:: {systemTime.toISOString().split('T')[1].split('.')[0]} UTC</span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end max-w-2xl">
            <div className="relative group w-full max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-matrix-dim" />
              </div>
              <input
                type="text"
                placeholder="SEARCH_MARKET_DATABASE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/50 border border-matrix-dim text-matrix-green text-sm pl-10 pr-4 py-2 focus:outline-none focus:border-matrix-green focus:shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all placeholder-matrix-bright"
              />
            </div>
          </div>
        </div>
        
        {/* Ticker */}
        <div className="h-8 bg-matrix-dark border-b border-matrix-dim flex items-center overflow-hidden whitespace-nowrap">
           <div className="animate-[scroll_30s_linear_infinite] flex gap-8 text-xs text-matrix-dim px-4">
             {markets.length > 0 ? markets.slice(0, 10).map(m => (
               <span key={m.id} className="flex gap-2 items-center">
                 <span className="text-white font-bold">{m.slug.split('-').slice(0,3).join(' ').toUpperCase()}</span> 
                 <span className="text-matrix-green font-mono">${formatNumber(m.volume)} VOL</span>
                 <LiveValue value={m.tokens[0]?.price} formatter={formatPercentage} className={`${m.tokens[0]?.price > 0.5 ? 'text-green-400' : 'text-red-400'}`} />
               </span>
             )) : <span>INITIALIZING CLOB STREAM...</span>}
          </div>
        </div>
      </header>

      <div className="flex max-w-[1920px] mx-auto min-h-[calc(100vh-96px)]">
        {/* --- Sidebar --- */}
        <aside className="w-20 md:w-64 border-r border-matrix-dim bg-black/80 hidden md:block shrink-0 sticky top-24 h-[calc(100vh-96px)] overflow-y-auto custom-scrollbar z-30">
          <div className="p-4 space-y-8">
            <div className="space-y-1">
              <h3 className="text-[10px] text-matrix-dim font-bold uppercase mb-3 pl-2 border-l-2 border-matrix-dim tracking-[0.2em]">Sectors</h3>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-all duration-300 relative overflow-hidden group ${
                    activeCategory === cat.id 
                      ? 'text-black font-bold' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <div className={`absolute inset-0 bg-matrix-green transition-transform duration-300 origin-left ${activeCategory === cat.id ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-10 opacity-20'}`}></div>
                  <div className="relative z-10 flex items-center gap-3">
                    {cat.id === 'crypto' && <Zap size={16} />}
                    {cat.id === 'politics' && <Globe size={16} />}
                    {cat.id === 'sports' && <Activity size={16} />}
                    {cat.id === 'business' && <DollarSign size={16} />}
                    {cat.id === 'science' && <Cpu size={16} />}
                    {cat.id === 'trending' && <TrendingUp size={16} />}
                    {cat.id === 'new' && <AlertTriangle size={16} />}
                    {cat.id === 'culture' && <Hash size={16} />}
                    <span className="hidden md:inline tracking-wider">{cat.label}</span>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="p-4 border border-matrix-green/30 bg-matrix-green/5 rounded">
              <div className="text-xs text-matrix-green font-bold mb-2 flex items-center gap-2"><Activity size={12}/> MARKET_PULSE</div>
              <div className="text-2xl font-bold text-white mb-1">{formatNumber(totalVol)}</div>
              <div className="text-[10px] text-matrix-dim">TOTAL VOLUME</div>
            </div>
          </div>
        </aside>

        {/* --- Content --- */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto h-[calc(100vh-96px)] custom-scrollbar">
          <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4 border-b border-matrix-dim/30 pb-4">
             <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-matrix-green animate-pulse">{'>'}</span> 
                  <GlitchText text={activeCategory.toUpperCase()} />
                </h2>
                <div className="text-xs text-matrix-dim font-mono flex gap-4">
                   <span>MARKETS_LOADED: {filteredMarkets.length}</span>
                   <span className="flex items-center gap-2"><Radio size={10} className={wsConnected ? "animate-pulse text-matrix-green" : "text-gray-500"}/> SOCKET_STATUS: {wsConnected ? "ONLINE" : "CONNECTING..."}</span>
                </div>
             </div>
             <div className="flex gap-2">
               {[
                 { label: '24H VOL', key: 'volume24hr' },
                 { label: 'END DATE', key: 'endDate' }
               ].map((opt) => (
                 <button 
                   key={opt.key}
                   onClick={() => handleSort(opt.key as keyof Market)}
                   className={`px-4 py-2 text-xs border transition-colors font-bold tracking-wider flex items-center gap-2 ${
                     sortConfig.key === opt.key 
                       ? 'bg-matrix-green text-black border-matrix-green' 
                       : 'border-matrix-dim text-matrix-green hover:bg-matrix-green hover:text-black'
                   }`}
                 >
                   {opt.label}
                   {sortConfig.key === opt.key && (
                     sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                   )}
                 </button>
               ))}
               <button onClick={fetchData} className="px-4 py-2 text-xs border border-matrix-dim hover:bg-matrix-green hover:text-black transition-colors flex items-center gap-2">
                 <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
               </button>
             </div>
          </div>

          <div className="border border-matrix-dim bg-black/60 backdrop-blur-sm relative min-h-[600px] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-matrix-dim text-[10px] md:text-xs text-matrix-dim font-bold uppercase tracking-[0.1em] bg-matrix-dark/50 shrink-0">
              <div className="col-span-12 md:col-span-5 pl-2">Market Contract</div>
              <div className="hidden md:block col-span-2 text-right">Top Outcome</div>
              <div className="hidden md:block col-span-2 text-right">24H Volume</div>
              <div className="hidden md:block col-span-2 text-right">End Date</div>
              <div className="hidden md:block col-span-1 text-center">Data</div>
            </div>

            {/* List */}
            <div className="grow relative">
              {loading && markets.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-matrix-green space-y-4 bg-black/90 z-20">
                  <div className="w-20 h-20 border-4 border-matrix-dim border-t-matrix-green rounded-full animate-spin shadow-[0_0_20px_rgba(0,255,65,0.4)]"></div>
                  <div className="font-tech tracking-widest text-lg animate-pulse">DECRYPTING CLOB DATA...</div>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 space-y-4 bg-black/90 z-20">
                   <AlertTriangle size={64} className="animate-pulse" />
                   <div className="text-2xl font-bold tracking-widest">CONNECTION LOST</div>
                   <button onClick={fetchData} className="px-6 py-3 border border-red-500 hover:bg-red-500 hover:text-white uppercase font-bold tracking-wider transition-all">Retry Handshake</button>
                </div>
              ) : (
                <div className="divide-y divide-matrix-dim/20">
                  {sortedMarkets.map((market) => (
                    <MarketRow 
                      key={market.id} 
                      initialMarket={market} 
                      isExpanded={expandedMarketId === market.id}
                      onToggle={() => setExpandedMarketId(expandedMarketId === market.id ? null : market.id)}
                    />
                  ))}
                  <div className="h-20"></div> {/* Spacer */}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;