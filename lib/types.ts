export type UserRole = 'super_admin' | 'auctioneer' | 'bidder';
export type KycStatus = 'pending' | 'approved' | 'rejected';

export type AppUser = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  kyc_status: KycStatus;
  is_suspended: boolean;
  is_banned: boolean;
};

export type Lot = {
  id: string;
  auction_id: string;
  title: string;
  description: string | null;
  photos: string[];
  starting_bid: number;
  reserve: number | null;
  buy_now: number | null;
  increment: number;
  current_bid: number | null;
  winner_id: string | null;
  category: string | null;
};
