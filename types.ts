export interface Market {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource: string;
  endDate: string;
  creationDate: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  groupItemTitle: string;
  description: string;
  tags: string[];
  tokens: Token[];
  rewards: any;
  volume: number;
  liquidity: number;
  outcomes: string[];
  outcomePrices: string[];
  volume24hr: number;
  clobTokenIds: string[];
}

export interface Token {
  tokenId: string;
  clobTokenId: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface Category {
  id: string;
  label: string;
  apiTag: string | null;
}

export interface SortOption {
  id: string;
  label: string;
  key: keyof Market;
  direction: 'asc' | 'desc';
}

export interface HistoryPoint {
  t: number;
  p: number;
}