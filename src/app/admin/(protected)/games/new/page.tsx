import { getSettings } from '@/lib/settings';
import { Back, Flash, PageHeader } from '@/components/admin/ui';
import GameForm from '@/components/admin/GameForm';
import { createGame } from '../actions';

export default async function NewGamePage({ searchParams }: { searchParams: { msg?: string; err?: string } }) {
  const s = await getSettings();
  return (
    <>
      <Back href="/admin/games" label="All games" />
      <PageHeader title="Add a game" />
      <Flash searchParams={searchParams} />
      <div className="panel max-w-2xl">
        <GameForm action={createGame} defaults={{ total_inventory: s.defaultInventory, is_published: false }} submitLabel="Add game" />
      </div>
    </>
  );
}
