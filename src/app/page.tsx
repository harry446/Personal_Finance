import { SignInScreen } from '@/components/sign-in-screen';
import { redirectAuthenticatedUser } from '@/lib/current-user';

export default async function Home() {
  await redirectAuthenticatedUser();

  return <SignInScreen />;
}
