import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { db } from '@/lib/db';

export function createBootstrapAdapter(): Adapter {
  const adapter = PrismaAdapter(db as never);

  return {
    ...adapter,
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const createdUser = await db.$transaction(async (transaction) => {
        const newUser = await transaction.user.create({ data: user });

        await bootstrapDefaultCategories(transaction, newUser.id);

        return newUser;
      });

      return createdUser as AdapterUser;
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: createBootstrapAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
  ],
  pages: {
    error: '/sign-in',
    signIn: '/sign-in',
  },
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
