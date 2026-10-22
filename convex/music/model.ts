import { defineTable } from 'convex/server';
import { v, type Infer } from 'convex/values';

export const provider = v.union(v.literal('spotify'), v.literal('youtube'));
export type Provider = Infer<typeof provider>;
export const musicItem = v.object({
  id: v.string(), title: v.string(), subtitle: v.string(), image: v.optional(v.string()),
  url: v.string(), uri: v.optional(v.string()), kind: v.union(v.literal('track'), v.literal('playlist')),
});
export type MusicItem = Infer<typeof musicItem>;
export const libraryPage = v.object({ items: v.array(musicItem), next: v.optional(v.string()), notice: v.optional(v.string()) });
export type LibraryPage = Infer<typeof libraryPage>;
export const collection = v.union(v.literal('liked'), v.literal('top'), v.literal('playlists'), v.literal('recent'), v.literal('playlist'));
export const tokenFields = { accessToken: v.string(), refreshToken: v.string(), expiresAt: v.number(), scope: v.string() };
export const musicTables = {
  musicConnections: defineTable({
    userId: v.id('users'), provider, ...tokenFields,
    status: v.union(v.literal('connected'), v.literal('reconnect')),
    connectedAt: v.number(), premium: v.optional(v.boolean()),
    refreshLease: v.optional(v.string()), refreshUntil: v.optional(v.number()),
    refreshCount: v.optional(v.number()), blockedUntil: v.optional(v.number()),
  }).index('by_userId_and_provider', ['userId', 'provider']),
  musicStates: defineTable({ userId: v.id('users'), provider, stateHash: v.string(), returnTo: v.string(), expiresAt: v.number(), used: v.optional(v.boolean()) })
    .index('by_stateHash', ['stateHash']).index('by_userId_and_provider', ['userId', 'provider']).index('by_expiresAt', ['expiresAt']),
  musicCache: defineTable({ connectionId: v.id('musicConnections'), key: v.string(), page: libraryPage, expiresAt: v.number() })
    .index('by_connectionId_and_key', ['connectionId', 'key']).index('by_expiresAt', ['expiresAt']),
};
