export type Team = 'jazz' | 'mammoth';

export type Game = {
  id: string;
  team: Team;
  opponent: string;
  game_date: string; // YYYY-MM-DD (local)
  start_time: string; // HH:MM:SS (local)
  timezone: string;
  starts_at: string;
  venue: string;
  total_inventory: number;
  is_published: boolean;
  is_closed: boolean;
  notes: string | null;
  reminder_sent_at: string | null;
  allocated: number;
  remaining: number;
  created_at: string;
  updated_at: string;
};

/** The only game fields ever sent to the public site. */
export type PublicGame = Pick<
  Game,
  'id' | 'team' | 'opponent' | 'game_date' | 'start_time' | 'venue' | 'total_inventory' | 'remaining' | 'is_closed'
>;

export type Client = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  is_archived: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Allocation = {
  id: string;
  game_id: string;
  client_id: string;
  quantity: number;
  status: 'confirmed' | 'cancelled';
  source: 'public' | 'admin';
  reserved_by: string | null;
  requested_at: string;
  cancelled_at: string | null;
  notes: string | null;
};

export type AllocationRow = Allocation & {
  clients: Pick<Client, 'id' | 'full_name' | 'email'>;
  games: Pick<Game, 'id' | 'team' | 'opponent' | 'game_date' | 'start_time' | 'venue' | 'is_closed'>;
};
