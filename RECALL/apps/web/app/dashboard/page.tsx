'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { LinkWithSummary, Category } from '@recall/shared';
import styles from './page.module.css';

const DEFAULT_CATEGORIES = [
  'Tools & Apps',
  'Courses',
  'Opportunities',
  'Inspiration',
  'Resources',
  'News & Trends',
  'Locations',
  'Reference'
];

export default function DashboardPage() {
  const [links, setLinks] = useState<LinkWithSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Form state
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [streakCount, setStreakCount] = useState(0);

  // Auth & detail state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<LinkWithSummary | null>(null);
  const [categoryUpdating, setCategoryUpdating] = useState(false);
  
  const router = useRouter();

  // ─── HELPER: relativeTime ──────────────────────────────────────────────────
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;

    return date.toLocaleDateString();
  };

  // ─── HELPER: fetch single full link ────────────────────────────────────────
  const fetchSingleFullLink = async (linkId: string): Promise<LinkWithSummary | null> => {
    try {
      const { data, error } = await supabase
        .from('links')
        .select(`
          *,
          ai_summaries (*),
          link_categories (
            category_id,
            categories (*)
          )
        `)
        .eq('id', linkId)
        .single();

      if (error) throw error;
      return data as LinkWithSummary;
    } catch (err) {
      console.error(`Error fetching single link ${linkId}:`, err);
      return null;
    }
  };

  // ─── DATA FETCHING ────────────────────────────────────────────────────────
  const fetchLinksAndUserStats = async (userId: string) => {
    try {
      // Fetch user profile streak
      const { data: profile } = await supabase
        .from('users')
        .select('streak_count')
        .eq('id', userId)
        .maybeSingle();
      if (profile) setStreakCount(profile.streak_count);

      // Fetch links
      const { data, error } = await supabase
        .from('links')
        .select(`
          *,
          ai_summaries (*),
          link_categories (
            category_id,
            categories (*)
          )
        `)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) throw error;
      setLinks((data || []) as LinkWithSummary[]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, color, is_default')
      .order('name');
    if (data) setCategories(data as Category[]);
  };

  useEffect(() => {
    let channel: any;

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      setAuthLoading(false);
      
      fetchLinksAndUserStats(session.user.id);
      fetchCategories();

      // Subscribe to real-time changes
      channel = supabase
        .channel(`user-web-links-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'links',
            filter: `user_id=eq.${session.user.id}`,
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              const fullLink = await fetchSingleFullLink(payload.new.id);
              if (fullLink) setLinks((prev) => [fullLink, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              const fullLink = await fetchSingleFullLink(payload.new.id);
              if (fullLink) {
                setLinks((prev) => prev.map((l) => (l.id === payload.new.id ? fullLink : l)));
                // Also update selectedLink if it's currently open
                setSelectedLink((curr) => curr?.id === payload.new.id ? fullLink : curr);
              }
            } else if (payload.eventType === 'DELETE') {
              setLinks((prev) => prev.filter((l) => l.id !== payload.old.id));
              setSelectedLink((curr) => curr?.id === payload.old.id ? null : curr);
            }
          }
        )
        .subscribe();
    };

    checkAuth();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────────
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('links').insert({
        user_id: user.id,
        url: url.trim(),
        user_note: note.trim() || null,
        status: 'pending',
        platform: 'other'
      });

      if (error) throw error;

      setUrl('');
      setNote('');
    } catch (err: any) {
      const errorMessage = err?.message || err?.details || (err ? JSON.stringify(err) : 'Unknown error');
      console.error(`Error adding link: ${errorMessage}`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkActioned = async (linkId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('links')
        .update({
          is_actioned: true,
          status: 'done',
          actioned_at: new Date().toISOString()
        })
        .eq('id', linkId);

      if (error) throw error;

      // Increment streak via stored RPC
      await supabase.rpc('increment_streak', { user_id_param: user.id });
      
      // Update local streak state
      setStreakCount((prev) => prev + 1);

      // Re-fetch detail
      const updated = await fetchSingleFullLink(linkId);
      if (updated) setSelectedLink(updated);
    } catch (err) {
      console.error('Error actioning link:', err);
    }
  };

  const handleUpdateCategory = async (linkId: string, categoryId: string) => {
    setCategoryUpdating(true);
    try {
      // Delete existing categories associated
      await supabase.from('link_categories').delete().eq('link_id', linkId);

      if (categoryId) {
        // Insert new association
        const { error } = await supabase
          .from('link_categories')
          .insert({
            link_id: linkId,
            category_id: categoryId,
            assigned_by: 'user'
          });
        if (error) throw error;
      }

      const updated = await fetchSingleFullLink(linkId);
      if (updated) setSelectedLink(updated);
    } catch (err) {
      console.error('Error updating category:', err);
    } finally {
      setCategoryUpdating(false);
    }
  };

  const getFreshnessLabel = (score: number) => {
    if (score >= 7) return { label: 'Still relevant', color: '#10b981' };
    if (score >= 4) return { label: 'May be outdated', color: '#f59e0b' };
    return { label: 'Likely outdated', color: '#ef4444' };
  };

  // Filter links by selected Category
  const filteredLinks = selectedCategory
    ? links.filter((link) =>
        link.link_categories?.some((lc) => lc.categories?.name === selectedCategory)
      )
    : links;

  const urgentCount = links.filter(
    (l) => !l.is_actioned && l.ai_summaries?.is_time_sensitive
  ).length;

  if (authLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
        <p>Loading your library...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Top Navbar Header */}
      <header className={styles.navbar}>
        <div className={styles.logo}>
          <h1>Recall</h1>
          <span className={styles.tag}>Web Dashboard</span>
        </div>

        <div className={styles.navRight}>
          <div className={styles.userBadge}>
            <div className={styles.avatar}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userEmail}>{user.email}</span>
          </div>

          <div className={styles.streakIndicator} title="Your Action Streak">
            <span className={styles.fireIcon}>🔥</span>
            <span className={styles.streakVal}>{streakCount} day streak</span>
          </div>

          <button 
            className={styles.logoutBtn}
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className={styles.container}>
        {/* Left Control Sidebar */}
        <aside className={styles.sidebar}>
          {/* Quick Stats Panel */}
          <div className={styles.sidebarSection}>
            <h3>Your Status</h3>
            <div className={styles.miniStatsGrid}>
              <div className={styles.miniStatItem}>
                <span className={styles.miniStatNum}>{links.length}</span>
                <span className={styles.miniStatLbl}>Total Saved</span>
              </div>
              <div className={styles.miniStatItem}>
                <span className={styles.miniStatNum}>{links.filter((l) => l.is_actioned).length}</span>
                <span className={styles.miniStatLbl}>Actioned</span>
              </div>
            </div>
            {urgentCount > 0 && (
              <div className={styles.urgentAlertBox}>
                ⚠️ <span>{urgentCount} time-sensitive items waiting!</span>
              </div>
            )}
          </div>

          {/* Add Link Section */}
          <div className={styles.sidebarSection}>
            <h3>Save a new URL</h3>
            <form onSubmit={handleAddLink} className={styles.addForm}>
              <input
                type="url"
                placeholder="https://example.com/article-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                required
              />
              <textarea
                placeholder="Add optional notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={loading}
                rows={3}
              />
              <button type="submit" disabled={loading || !url.trim()} className={styles.saveBtn}>
                {loading ? 'Saving...' : 'Save to Library'}
              </button>
            </form>
          </div>

          {/* Category Filter Pills List */}
          <div className={styles.sidebarSection}>
            <h3>Categories</h3>
            <div className={styles.categoryFilters}>
              <button
                className={`${styles.filterPill} ${selectedCategory === null ? styles.filterPillActive : ''}`}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </button>
              {DEFAULT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.filterPill} ${selectedCategory === cat ? styles.filterPillActive : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Central Feed Grid */}
        <main className={styles.feed}>
          <div className={styles.feedHeader}>
            <h2>{selectedCategory ? `${selectedCategory} Items` : 'All Saved Items'} ({filteredLinks.length})</h2>
          </div>

          {filteredLinks.length === 0 ? (
            <div className={styles.emptyFeed}>
              <span className={styles.emptyIcon}>📥</span>
              <p>
                {selectedCategory
                  ? `No items categorized as "${selectedCategory}" found.`
                  : 'Start saving links from web browsers or apps, and AI will summarize them here!'}
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredLinks.map((link) => {
                const summaryObj = link.ai_summaries;
                const catInfo = link.link_categories?.[0]?.categories;
                const isPending = link.status === 'pending';
                const isUrgent = summaryObj?.is_time_sensitive && !link.is_actioned;

                return (
                  <div
                    key={link.id}
                    className={`${styles.card} ${link.is_actioned ? styles.cardActioned : ''}`}
                    onClick={() => setSelectedLink(link)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span className={styles.platformLabel}>{link.platform.toUpperCase()}</span>
                      {isUrgent && <span className={styles.urgentBadge}>Urgent</span>}
                    </div>

                    <h3 className={styles.cardTitle}>{link.title || link.url}</h3>
                    
                    {isPending ? (
                      <div className={styles.pendingCardBox}>
                        <div className={styles.cardSpinner}></div>
                        <span>Processing summary...</span>
                      </div>
                    ) : (
                      summaryObj?.summary && (
                        <p className={styles.cardSummary}>{summaryObj.summary}</p>
                      )
                    )}

                    <div className={styles.cardResources}>
                      {summaryObj?.resources?.slice(0, 3).map((res, i) => (
                        <span key={i} className={styles.resourceChip}>{res.name}</span>
                      ))}
                      {(summaryObj?.resources?.length || 0) > 3 && (
                        <span className={styles.resourceChipMore}>+{(summaryObj?.resources?.length || 0) - 3} more</span>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      {catInfo && (
                        <span 
                          className={styles.catBadge} 
                          style={{ color: catInfo.color, backgroundColor: `${catInfo.color}18` }}
                        >
                          {catInfo.name}
                        </span>
                      )}
                      <span className={styles.timeLabel}>{formatRelativeTime(link.saved_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Details Side Drawer Overlay */}
      {selectedLink && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedLink(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <header className={styles.drawerHeader}>
              <div className={styles.drawerPlatform}>
                <span className={styles.drawerPlatformText}>{selectedLink.platform.toUpperCase()}</span>
                <span className={styles.drawerTimeText}>{formatRelativeTime(selectedLink.saved_at)}</span>
              </div>
              <button className={styles.closeDrawerBtn} onClick={() => setSelectedLink(null)}>
                &times;
              </button>
            </header>

            <div className={styles.drawerBody}>
              <h2 className={styles.drawerTitle}>{selectedLink.title || selectedLink.url}</h2>
              <a href={selectedLink.url} target="_blank" rel="noopener noreferrer" className={styles.drawerUrl}>
                Open Original Site ↗
              </a>

              {selectedLink.user_note && (
                <div className={styles.drawerSection}>
                  <h4>Your Notes</h4>
                  <p className={styles.userNoteBox}>{selectedLink.user_note}</p>
                </div>
              )}

              {selectedLink.status === 'pending' ? (
                <div className={styles.drawerPendingBox}>
                  <div className={styles.spinner}></div>
                  <p>Recall AI is compiling takeaways for this link...</p>
                </div>
              ) : (
                selectedLink.ai_summaries && (
                  <>
                    <div className={styles.drawerSection}>
                      <h4>AI Summary</h4>
                      <p className={styles.drawerText}>{selectedLink.ai_summaries.summary}</p>
                    </div>

                    {selectedLink.ai_summaries.key_points && selectedLink.ai_summaries.key_points.length > 0 && (
                      <div className={styles.drawerSection}>
                        <h4>Key Takeaways</h4>
                        <ul className={styles.takeawaysList}>
                          {selectedLink.ai_summaries.key_points.map((point: string, i: number) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedLink.ai_summaries.resources && selectedLink.ai_summaries.resources.length > 0 && (
                      <div className={styles.drawerSection}>
                        <h4>Tools Mentioned</h4>
                        <div className={styles.toolsGrid}>
                          {selectedLink.ai_summaries.resources.map((res: any, i: number) => (
                            <a 
                              key={i} 
                              href={res.url || '#'} 
                              target={res.url ? '_blank' : '_self'}
                              rel="noopener noreferrer"
                              className={styles.toolLink}
                            >
                              {res.name} <span className={styles.toolType}>({res.type})</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedLink.ai_summaries.freshness_score !== null && (
                      <div className={styles.drawerSection}>
                        <h4>Freshness Rating</h4>
                        <div className={styles.freshnessContainer}>
                          <div className={styles.freshnessBarBg}>
                            <div 
                              className={styles.freshnessBarFill}
                              style={{ 
                                width: `${selectedLink.ai_summaries.freshness_score * 10}%`,
                                backgroundColor: getFreshnessLabel(selectedLink.ai_summaries.freshness_score).color 
                              }}
                            ></div>
                          </div>
                          <span 
                            style={{ 
                              color: getFreshnessLabel(selectedLink.ai_summaries.freshness_score).color,
                              fontWeight: '600',
                              fontSize: '13px'
                            }}
                          >
                            {getFreshnessLabel(selectedLink.ai_summaries.freshness_score).label} ({selectedLink.ai_summaries.freshness_score}/10)
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )
              )}
            </div>

            <footer className={styles.drawerFooter}>
              {/* Category Dropdown */}
              <div className={styles.categoryDropdown}>
                <label>Change Category:</label>
                <select
                  disabled={categoryUpdating}
                  value={selectedLink.link_categories?.[0]?.category_id || ''}
                  onChange={(e) => handleUpdateCategory(selectedLink.id, e.target.value)}
                >
                  <option value="">No Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedLink.is_actioned ? (
                <button
                  className={styles.actionBtn}
                  onClick={() => handleMarkActioned(selectedLink.id)}
                >
                  Mark as Actioned ✓
                </button>
              ) : (
                <div className={styles.actionedConfirmBox}>
                  ✓ Already Actioned
                </div>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
