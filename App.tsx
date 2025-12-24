import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, TrendingUp, Zap, Skull, DollarSign, Globe, Lock, Search, BarChart3, Filter, ShieldAlert, Cpu, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Hash, Radio, ArrowUp, ArrowDown } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MatrixRain from './components/MatrixRain';
import GlitchText from './components/GlitchText';
import { Market, Category, HistoryPoint } from './types';
import { getMarkets, getMarket, getMarketHistory, livePriceManager, formatCurrency, formatNumber, formatPercentage, formatCents } from './services/polymarketService';

// --- Types & Constants ---
type ViewState = 'LANDING' | 'DASHBOARD';

const CATEGORIES: Category[] = [
  { id: 'all', label: 'ROOT_ALL', apiTag: null },
  { id: 'trending', label: 'TRENDING', apiTag: null }, 
  { id: 'crypto', label: 'CRYPTO', apiTag: 'crypto' },
  { id: 'politics', label: 'POLITICS', apiTag: 'politics' },
  { id: 'sports', label: 'SPORTS', apiTag: 'sports' },
  { id: 'business', label: 'BUSINESS', apiTag: 'business' },
  { id: 'science', label: 'SCIENCE', apiTag: 'science' },
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

  return (
    <span className={`transition-colors duration-500 ${flash === 'green' ? 'text-matrix-green text-shadow-green' : flash === 'red' ? 'text-red-500 text-shadow-red' : className}`}>
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
            <p>> CONNECTING TO CLOB NODES...</p>
            <p>> PARSING EVENT CONTRACTS...</p>
            <p>> CALCULATING IMPLIED PROBABILITIES...</p>
            <p className="text-white animate-pulse">> SYSTEM READY.</p>
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

// --- Main Application Component ---
const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LANDING');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemTime, setSystemTime] = useState(new Date());
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Market; direction: 'asc' | 'desc' }>({
    key: 'volume24hr',
    direction: 'desc'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const category = CATEGORIES.find(c => c.id === activeCategory);
      const data = await getMarkets(category?.apiTag);
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
    if (markets.length > 0) {
      // Extract all CLOB token IDs from the top tokens of displayed markets
      const tokensToSubscribe = markets
        .flatMap(m => m.tokens.slice(0, 2)) // Get top 2 tokens per market
        .map(t => t.clobTokenId)
        .filter(id => id && id.length > 10); // Simple validity check

      // Connect to WebSocket via Service
      if (tokensToSubscribe.length > 0) {
        livePriceManager.subscribe(tokensToSubscribe, (assetId, price) => {
          setWsConnected(true);
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
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-matrix-green animate-pulse' : 'bg-yellow-600'}`}></div> 
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
                 <span className="text-matrix-green font-mono">${formatNumber(m.volume24hr)} VOL</span>
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
                    {cat.id === 'all' && <Terminal size={16} />}
                    <span className="hidden md:inline tracking-wider">{cat.label}</span>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="p-4 border border-matrix-green/30 bg-matrix-green/5 rounded">
              <div className="text-xs text-matrix-green font-bold mb-2 flex items-center gap-2"><Activity size={12}/> MARKET_PULSE</div>
              <div className="text-2xl font-bold text-white mb-1">{formatNumber(totalVol)}</div>
              <div className="text-[10px] text-matrix-dim">TOTAL 24H VOLUME</div>
            </div>
          </div>
        </aside>

        {/* --- Content --- */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto h-[calc(100vh-96px)] custom-scrollbar">
          <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4 border-b border-matrix-dim/30 pb-4">
             <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
                  <span className="text-matrix-green animate-pulse">></span> 
                  <GlitchText text={activeCategory.toUpperCase()} />
                </h2>
                <div className="text-xs text-matrix-dim font-mono flex gap-4">
                   <span>MARKETS_LOADED: {filteredMarkets.length}</span>
                   <span className="flex items-center gap-2"><Radio size={10} className={wsConnected ? "animate-pulse text-matrix-green" : "text-gray-500"}/> SOCKET_STATUS: {wsConnected ? "ONLINE" : "CONNECTING..."}</span>
                </div>
             </div>
             <div className="flex gap-2">
               {[
                 { label: 'VOL', key: 'volume24hr' },
                 { label: 'LIQ', key: 'liquidity' },
                 { label: 'END', key: 'endDate' }
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
              <div className="hidden md:block col-span-2 text-right">Volume (24h)</div>
              <div className="hidden md:block col-span-2 text-right">Liquidity</div>
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

// --- Sub-components ---

const MarketRow: React.FC<{ initialMarket: Market; isExpanded: boolean; onToggle: () => void }> = ({ initialMarket, isExpanded, onToggle }) => {
  const [market, setMarket] = useState(initialMarket);
  const topToken = market.tokens[0];
  const topPrice = topToken ? topToken.price : 0;
  
  // Fetch history only when expanded to save bandwidth
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Poll for updates when expanded
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isExpanded) {
      // Immediate fetch for details if needed (and history)
      if (topToken && history.length === 0) {
        setLoadingHistory(true);
        // Ensure we have a token ID before fetching history
        if (topToken.clobTokenId) {
            getMarketHistory(topToken.clobTokenId).then(data => {
            setHistory(data);
            setLoadingHistory(false);
            });
        }
      }

      // Polling for metadata updates (volume/liquidity) - Price is handled by WS now globally
      interval = setInterval(async () => {
        const freshData = await getMarket(market.id);
        if (freshData) {
            // Merge fresh metadata with current live prices
            setMarket(prev => ({
                ...freshData,
                tokens: freshData.tokens.map(t => {
                   // Preserve live price if we have it, otherwise use fresh
                   // Actually, freshData might be older than WS data, so be careful.
                   // For now, let's just update metadata like volume.
                   const existingToken = prev.tokens.find(pt => pt.tokenId === t.tokenId);
                   return { ...t, price: existingToken ? existingToken.price : t.price };
                })
            }));
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isExpanded, market.id, topToken?.clobTokenId]);

  // Sync initial prop updates if they come from main list refresh (which now includes WS data)
  useEffect(() => {
    setMarket(initialMarket);
  }, [initialMarket]);

  return (
    <div className={`transition-all duration-300 ${isExpanded ? 'bg-matrix-green/5' : 'hover:bg-matrix-dim/5'}`}>
      {/* Row Header */}
      <div 
        onClick={onToggle}
        className="grid grid-cols-12 gap-4 p-4 items-center cursor-pointer group border-l-2 border-transparent hover:border-matrix-green transition-all relative"
      >
        {isExpanded && <div className="absolute left-0 top-0 bottom-0 w-1 bg-matrix-green shadow-[0_0_10px_rgba(0,255,65,0.8)]"></div>}
        
        <div className="col-span-12 md:col-span-5 flex items-center gap-4 pl-2">
           <div className="relative shrink-0">
             <img src={market.icon || market.image} alt="" className="w-10 h-10 rounded-sm border border-matrix-dim/50 bg-black object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
             {market.active && <div className="absolute -top-1 -right-1 w-2 h-2 bg-matrix-green rounded-full animate-pulse shadow-[0_0_5px_rgba(0,255,65,1)]"></div>}
           </div>
           <div className="min-w-0">
              <h4 className={`text-sm font-bold truncate pr-4 transition-colors ${isExpanded ? 'text-matrix-green' : 'text-gray-200 group-hover:text-white'}`}>
                {market.question}
              </h4>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                 {market.tags.slice(0, 3).map(tag => (
                   <span key={tag} className="text-[10px] border border-matrix-dim/50 px-1.5 py-0.5 text-matrix-dim uppercase tracking-wider">{tag}</span>
                 ))}
                 {market.new && <span className="text-[10px] bg-matrix-green text-black px-1.5 py-0.5 font-bold animate-pulse">NEW</span>}
              </div>
           </div>
        </div>

        <div className="hidden md:flex col-span-2 flex-col items-end">
           <LiveValue 
             value={topPrice} 
             formatter={formatPercentage} 
             className={`text-lg font-bold font-tech ${topPrice > 0.5 ? 'text-matrix-green' : 'text-yellow-500'}`} 
           />
           <span className="text-[10px] text-gray-500 truncate max-w-full">{topToken?.outcome}</span>
        </div>

        <div className="hidden md:block col-span-2 text-right text-sm text-gray-400 font-mono">
          <LiveValue value={market.volume24hr} formatter={formatCurrency} />
        </div>

        <div className="hidden md:block col-span-2 text-right text-sm text-gray-500 font-mono">
          <LiveValue value={market.liquidity} formatter={formatNumber} />
        </div>

        <div className="hidden md:flex col-span-1 justify-center">
          {isExpanded ? <ChevronUp size={16} className="text-matrix-green" /> : <ChevronDown size={16} className="text-matrix-dim" />}
        </div>
      </div>

      {/* Expanded Analysis View */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out border-b border-matrix-dim/20 ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-6 bg-black/40 border-t border-matrix-dim/20 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Chart Section */}
          <div className="lg:col-span-2 flex flex-col h-[300px]">
             <div className="flex justify-between items-center mb-4">
                <h5 className="text-xs font-bold text-matrix-green uppercase flex items-center gap-2">
                  <Activity size={14} /> Price Action ({topToken?.outcome})
                </h5>
                <div className="text-[10px] text-matrix-dim">INTERVAL: 1H // LIVE CLOB DATA</div>
             </div>
             <div className="flex-1 bg-matrix-dark/20 border border-matrix-dim/30 relative rounded-sm p-2">
                {loadingHistory ? (
                   <div className="absolute inset-0 flex items-center justify-center text-matrix-dim text-xs animate-pulse">LOADING HISTORICAL DATA...</div>
                ) : history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff41" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#00ff41" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #00ff41', color: '#fff', fontSize: '12px' }}
                        itemStyle={{ color: '#00ff41' }}
                        formatter={(val: number) => [formatCents(val), 'Price']}
                        labelFormatter={(t) => new Date(t * 1000).toLocaleTimeString()}
                      />
                      <Area type="monotone" dataKey="p" stroke="#00ff41" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-matrix-dim text-xs">NO CHART DATA AVAILABLE</div>
                )}
             </div>
          </div>

          {/* Outcomes & Actions Section */}
          <div className="flex flex-col gap-6">
             
             {/* Outcomes List */}
             <div className="flex-1 overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                <h5 className="text-xs font-bold text-white uppercase mb-3 flex items-center gap-2">
                   <Hash size={14} /> Market Depth
                </h5>
                <div className="space-y-2">
                   {market.tokens.slice(0, 6).map((token) => (
                     <div key={token.tokenId} className="group">
                        <div className="flex justify-between text-xs mb-1">
                           <span className="text-gray-300 group-hover:text-white truncate max-w-[70%]">{token.outcome}</span>
                           <LiveValue value={token.price} formatter={formatPercentage} className="font-mono" />
                        </div>
                        <div className="h-1.5 w-full bg-matrix-dark rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-matrix-dim group-hover:bg-matrix-green transition-all duration-300" 
                              style={{ width: `${token.price * 100}%` }}
                           ></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             {/* Action Buttons */}
             <div className="space-y-3 pt-4 border-t border-matrix-dim/30">
                <a 
                  href={`https://polymarket.com/event/${market.slug}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full text-center py-3 bg-matrix-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors text-sm shadow-[0_0_15px_rgba(0,255,65,0.4)] hover:shadow-[0_0_25px_rgba(255,255,255,0.6)]"
                >
                   Trade on Polymarket <ExternalLink size={14} className="inline ml-1 mb-0.5"/>
                </a>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-matrix-dark/40 border border-matrix-dim/30 p-2 text-center">
                      <div className="text-[10px] text-gray-500 uppercase">Volume</div>
                      <div className="text-xs font-mono text-white">
                        <LiveValue value={market.volume} formatter={formatNumber} />
                      </div>
                   </div>
                   <div className="bg-matrix-dark/40 border border-matrix-dim/30 p-2 text-center">
                      <div className="text-[10px] text-gray-500 uppercase">EndDate</div>
                      <div className="text-xs font-mono text-white">{market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A'}</div>
                   </div>
                </div>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;