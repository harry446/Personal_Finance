import { SignInScreen } from '@/components/sign-in-screen';
import { redirectAuthenticatedUser } from '@/lib/current-user';

export default async function SignInPage() {
  await redirectAuthenticatedUser();

  return <SignInScreen />;
}
