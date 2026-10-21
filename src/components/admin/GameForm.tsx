import { SubmitButton } from './buttons';

type Defaults = {
  id?: string;
  team?: string;
  opponent?: string;
  game_date?: string;
  start_time?: string;
  venue?: string;
  total_inventory?: number;
  is_published?: boolean;
  notes?: string | null;
};

export default function GameForm({ action, defaults, submitLabel, minInventory = 0 }: { action: (fd: FormData) => Promise<void>; defaults: Defaults; submitLabel: string; minInventory?: number }) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div>
        <label className="label" htmlFor="team">
          Team
        </label>
        <select id="team" name="team" defaultValue={defaults.team ?? 'jazz'} className="field">
          <option value="jazz">Utah Jazz</option>
          <option value="mammoth">Utah Mammoth</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="opponent">
          Opponent
        </label>
        <input id="opponent" name="opponent" defaultValue={defaults.opponent} placeholder="e.g. Denver Nuggets" className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="game_date">
          Date
        </label>
        <input id="game_date" name="game_date" type="date" defaultValue={defaults.game_date} className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="start_time">
          Start time (Salt Lake City)
        </label>
        <input id="start_time" name="start_time" type="time" defaultValue={defaults.start_time?.slice(0, 5)} className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="venue">
          Venue
        </label>
        <input id="venue" name="venue" defaultValue={defaults.venue ?? 'Delta Center'} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="total_inventory">
          Total tickets
        </label>
        <input id="total_inventory" name="total_inventory" type="number" min={minInventory} max={50} defaultValue={defaults.total_inventory ?? 4} className="field" required />
        {minInventory > 0 && <p className="mt-1 text-xs text-silver-500">{minInventory} already allocated — can&rsquo;t go lower.</p>}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="notes">
          Internal notes
        </label>
        <textarea id="notes" name="notes" rows={2} defaultValue={defaults.notes ?? ''} className="field" placeholder="Seat location, parking, who's picking up the tickets…" />
      </div>
      <label className="flex items-center gap-2 text-sm text-silver-300 sm:col-span-2">
        <input type="checkbox" name="is_published" defaultChecked={defaults.is_published ?? true} /> Published (visible on the public site)
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
