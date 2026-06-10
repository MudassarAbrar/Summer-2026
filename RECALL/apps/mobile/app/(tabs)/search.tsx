import React, { useState, useEffect } from 'react'
import { View, TextInput, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Keyboard } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { LinkWithSummary } from '@recall/shared'
import { COLORS } from '../../constants/colors'
import LinkCard from '../../components/cards/LinkCard'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LinkWithSummary[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const user = useAuthStore((state) => state.user)
  const router = useRouter()

  const handleSearch = async () => {
    if (!query.trim()) return
    Keyboard.dismiss()
    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      if (!user) throw new Error('User session not found')

      // 1. Call generate-embedding Edge Function
      const { data: embeddingResult, error: embeddingError } = await supabase.functions.invoke('generate-embedding', {
        body: { text: query.trim() }
      })

      if (embeddingError) throw new Error(`Embedding failed: ${embeddingError.message || embeddingError}`)
      const embedding = embeddingResult?.embedding

      if (!embedding) {
        throw new Error('Could not generate embedding for search query.')
      }

      // 2. Call pgvector similarity search RPC
      const { data: searchHits, error: rpcError } = await supabase.rpc('search_links', {
        query_embedding: embedding,
        user_id_param: user.id,
        match_count: 10
      })

      if (rpcError) throw rpcError

      const hits = searchHits || []
      if (hits.length === 0) {
        setResults([])
        return
      }

      // 3. Fetch full details for the link IDs matching results
      const linkIds = hits.map((h: { link_id: string }) => h.link_id)
      const { data: links, error: fetchError } = await supabase
        .from('links')
        .select(`
          *,
          ai_summaries (*),
          link_categories (
            category_id,
            categories (*)
          )
        `)
        .in('id', linkIds)

      if (fetchError) throw fetchError

      // Re-order links to match similarity score ranking
      const orderedLinks = linkIds
        .map((id: string) => links?.find((l) => l.id === id))
        .filter(Boolean) as LinkWithSummary[]

      setResults(orderedLinks)
    } catch (err) {
      console.error('Semantic search failed:', err)
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setSearched(false)
    setError(null)
  }

  return (
    <View style={styles.container}>
      {/* Search Bar Input */}
      <View style={styles.searchHeader}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search by topic, tool name, or keyword..."
            placeholderTextColor={COLORS.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching your knowledge base...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
            <Text style={styles.retryButtonText}>Retry Search</Text>
          </TouchableOpacity>
        </View>
      ) : !searched ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>AI Semantic Search</Text>
          <Text style={styles.emptyText}>
            Type a query to search by meaning. For example: "n8n automation" or "courses on deep learning".
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptyText}>
            We couldn't find any saved links matching your query. Try using different keywords.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <LinkCard
              link={item}
              onPress={() => router.push(`/link/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  searchHeader: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: COLORS.text,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 20,
    color: COLORS.muted,
    fontWeight: '300',
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  searchButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 24,
  },
})
