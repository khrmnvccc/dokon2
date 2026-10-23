import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { AddressBook } from '@/components/shop/account-forms';
import type { Address } from '@/lib/types';

export default async function AddressesPage() {
  const user = await requireUser('/account/addresses');
  const supabase = await getServerSupabase();
  const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at');
  return <AddressBook addresses={(data ?? []) as Address[]} />;
}
