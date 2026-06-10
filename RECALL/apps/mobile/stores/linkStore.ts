import { create } from 'zustand'
import { LinkWithSummary } from '@recall/shared'

interface LinkState {
  links: LinkWithSummary[]
  setLinks: (links: LinkWithSummary[]) => void
  addLink: (link: LinkWithSummary) => void
  updateLink: (id: string, updates: Partial<LinkWithSummary>) => void
  selectedCategory: string | null
  setSelectedCategory: (id: string | null) => void
}

export const useLinkStore = create<LinkState>((set) => ({
  links: [],
  setLinks: (links) => set({ links }),
  addLink: (link) => set((s) => ({ links: [link, ...s.links] })),
  updateLink: (id, updates) =>
    set((s) => ({
      links: s.links.map((l) => (l.id === id ? { ...l, ...updates } : l))
    })),
  selectedCategory: null,
  setSelectedCategory: (id) => set({ selectedCategory: id })
}))
