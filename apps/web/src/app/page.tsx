import { redirect } from 'next/navigation';

/** Root entrypoint redirects to the campaigns page. */
export default function HomePage() {
  redirect('/campaigns');
}
