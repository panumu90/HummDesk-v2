<template>
  <AppShell>
    <div class="knowledge-base-view">
      <div class="kb-header">
        <div class="kb-header-content">
          <h1 class="page-title">Knowledge Base</h1>
          <p class="page-subtitle">Manage articles for AI-powered customer support</p>
        </div>

        <button class="btn-primary" @click="showCreateModal = true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Create Article
        </button>
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
            <path d="M14 14l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search articles semantically..."
            class="search-input"
            @keydown.enter="performSearch"
          />
          <button v-if="searchQuery" class="clear-search" @click="clearSearch">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <button class="btn-search" @click="performSearch" :disabled="!searchQuery">
          Search
        </button>
      </div>

      <!-- Category Filter -->
      <div class="filter-section">
        <button
          v-for="cat in categories"
          :key="cat"
          class="filter-chip"
          :class="{ active: selectedCategory === cat }"
          @click="selectedCategory = selectedCategory === cat ? null : cat"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="shimmer-cards">
          <div class="shimmer-card shimmer" v-for="n in 6" :key="n"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="displayedArticles.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="16" y="12" width="32" height="40" rx="2" stroke="currentColor" stroke-width="3" fill="none"/>
            <path d="M24 24h16M24 32h16M24 40h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="empty-title">No Articles Found</h3>
        <p class="empty-description">
          {{ searchQuery ? 'Try a different search term' : 'Create your first knowledge base article' }}
        </p>
      </div>

      <!-- Articles Grid -->
      <div v-else class="articles-grid">
        <div
          v-for="article in displayedArticles"
          :key="article.id"
          class="article-card"
          @click="viewArticle(article)"
        >
          <!-- Header -->
          <div class="article-header">
            <div class="article-category" :class="`category-${article.category}`">
              {{ article.category }}
            </div>
            <div class="article-actions">
              <button class="icon-btn" @click.stop="editArticle(article)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
              </button>
              <button class="icon-btn" @click.stop="deleteArticle(article.id)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M5 4V3h6v1M6 7v4M10 7v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Title & Excerpt -->
          <h3 class="article-title">{{ article.title }}</h3>
          <p class="article-excerpt">{{ getExcerpt(article.content) }}</p>

          <!-- Tags -->
          <div v-if="article.tags && article.tags.length > 0" class="article-tags">
            <span v-for="tag in article.tags.slice(0, 3)" :key="tag" class="tag">
              {{ tag }}
            </span>
            <span v-if="article.tags.length > 3" class="tag-more">
              +{{ article.tags.length - 3 }}
            </span>
          </div>

          <!-- Footer -->
          <div class="article-footer">
            <div class="article-stat">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <circle cx="7" cy="7" r="2" fill="currentColor"/>
              </svg>
              {{ article.view_count }} views
            </div>
            <div class="article-stat">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              {{ formatDate(article.updated_at) }}
            </div>
          </div>

          <!-- Search Relevance Score -->
          <div v-if="article.relevance !== undefined" class="relevance-badge">
            {{ Math.round(article.relevance * 100) }}% match
          </div>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <div v-if="showCreateModal || editingArticle" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-header">
            <h2>{{ editingArticle ? 'Edit Article' : 'Create Article' }}</h2>
            <button class="modal-close" @click="closeModal">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label>Title</label>
              <input
                v-model="formData.title"
                type="text"
                class="input-glass"
                placeholder="e.g., How to reset your password"
              />
            </div>

            <div class="form-group">
              <label>Category</label>
              <select v-model="formData.category" class="input-glass">
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="sales">Sales</option>
                <option value="policies">Policies</option>
              </select>
            </div>

            <div class="form-group">
              <label>Content (Markdown supported)</label>
              <textarea
                v-model="formData.content"
                class="input-glass"
                rows="10"
                placeholder="Write your article content here..."
              ></textarea>
            </div>

            <div class="form-group">
              <label>Tags (comma-separated)</label>
              <input
                v-model="tagsInput"
                type="text"
                class="input-glass"
                placeholder="e.g., password, reset, security"
              />
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="formData.published" />
                <span>Publish immediately</span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="closeModal">Cancel</button>
            <button class="btn-primary" @click="saveArticle" :disabled="!formData.title || !formData.content">
              {{ editingArticle ? 'Update' : 'Create' }} Article
            </button>
          </div>
        </div>
      </div>

      <!-- View Article Modal -->
      <div v-if="viewingArticle" class="modal-overlay" @click.self="viewingArticle = null">
        <div class="modal-card modal-large">
          <div class="modal-header">
            <div>
              <h2>{{ viewingArticle.title }}</h2>
              <div class="article-meta">
                <span class="article-category" :class="`category-${viewingArticle.category}`">
                  {{ viewingArticle.category }}
                </span>
                <span class="meta-divider">•</span>
                <span>{{ viewingArticle.view_count }} views</span>
                <span class="meta-divider">•</span>
                <span>Updated {{ formatDate(viewingArticle.updated_at) }}</span>
              </div>
            </div>
            <button class="modal-close" @click="viewingArticle = null">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="article-content" v-html="renderMarkdown(viewingArticle.content)"></div>

            <div v-if="viewingArticle.tags && viewingArticle.tags.length > 0" class="article-tags-full">
              <span v-for="tag in viewingArticle.tags" :key="tag" class="tag">
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import AppShell from '@/layouts/AppShell.vue'

// ============================================================================
// TYPES
// ============================================================================

interface Article {
  id: number
  title: string
  content: string
  category: string
  tags: string[]
  view_count: number
  helpful_count: number
  published: boolean
  created_at: string
  updated_at: string
  relevance?: number // For search results
}

// ============================================================================
// STATE
// ============================================================================

const articles = ref<Article[]>([])
const searchResults = ref<Article[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)

const showCreateModal = ref(false)
const editingArticle = ref<Article | null>(null)
const viewingArticle = ref<Article | null>(null)

const formData = ref({
  title: '',
  content: '',
  category: 'general',
  tags: [] as string[],
  published: true,
})
const tagsInput = ref('')

const categories = ['general', 'billing', 'technical', 'sales', 'policies']

// ============================================================================
// COMPUTED
// ============================================================================

const displayedArticles = computed(() => {
  let result = searchQuery.value ? searchResults.value : articles.value

  if (selectedCategory.value) {
    result = result.filter((a) => a.category === selectedCategory.value)
  }

  return result
})

// ============================================================================
// METHODS
// ============================================================================

async function fetchArticles() {
  loading.value = true
  try {
    const response = await axios.get('/api/v1/knowledge-base', {
      params: {
        limit: 100,
      },
    })
    articles.value = response.data.data
  } catch (error) {
    console.error('Failed to fetch articles:', error)
  } finally {
    loading.value = false
  }
}

async function performSearch() {
  if (!searchQuery.value) return

  loading.value = true
  try {
    const response = await axios.post('/api/v1/knowledge-base/search', {
      query: searchQuery.value,
      limit: 20,
      min_relevance: 0.5,
    })
    searchResults.value = response.data.data
  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
}

function viewArticle(article: Article) {
  viewingArticle.value = article
}

function editArticle(article: Article) {
  editingArticle.value = article
  formData.value = {
    title: article.title,
    content: article.content,
    category: article.category,
    tags: article.tags || [],
    published: article.published,
  }
  tagsInput.value = article.tags ? article.tags.join(', ') : ''
}

async function saveArticle() {
  // Parse tags
  formData.value.tags = tagsInput.value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  try {
    if (editingArticle.value) {
      // Update
      await axios.patch(`/api/v1/knowledge-base/${editingArticle.value.id}`, formData.value)
    } else {
      // Create
      await axios.post('/api/v1/knowledge-base', formData.value)
    }

    closeModal()
    fetchArticles()
  } catch (error) {
    console.error('Failed to save article:', error)
    alert('Failed to save article. Please try again.')
  }
}

async function deleteArticle(id: number) {
  if (!confirm('Are you sure you want to delete this article?')) return

  try {
    await axios.delete(`/api/v1/knowledge-base/${id}`)
    articles.value = articles.value.filter((a) => a.id !== id)
  } catch (error) {
    console.error('Failed to delete article:', error)
    alert('Failed to delete article. Please try again.')
  }
}

function closeModal() {
  showCreateModal.value = false
  editingArticle.value = null
  formData.value = {
    title: '',
    content: '',
    category: 'general',
    tags: [],
    published: true,
  }
  tagsInput.value = ''
}

function getExcerpt(content: string): string {
  const maxLength = 150
  const stripped = content.replace(/[#*_\[\]()]/g, '').trim()
  return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function renderMarkdown(content: string): string {
  // Simple markdown rendering (in production, use a proper library like marked.js)
  return content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n/gim, '<br>')
}

// ============================================================================
// LIFECYCLE
// ============================================================================

onMounted(() => {
  fetchArticles()
})
</script>

<style scoped>
.knowledge-base-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-6);
  overflow-y: auto;
}

/* Header */
.kb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.kb-header-content h1 {
  margin: 0 0 var(--space-1) 0;
}

.kb-header-content p {
  margin: 0;
  color: var(--text-muted);
}

/* Search Section */
.search-section {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  color: var(--text-subtle);
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-10) var(--space-3) var(--space-10);
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-lg);
  color: var(--text);
  font-size: var(--text-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
}

.clear-search {
  position: absolute;
  right: var(--space-3);
  background: none;
  border: none;
  color: var(--text-subtle);
  cursor: pointer;
  padding: var(--space-1);
}

.btn-search {
  padding: var(--space-3) var(--space-6);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-lg);
  color: white;
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.btn-search:hover {
  transform: translateY(-1px);
}

.btn-search:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Filter Section */
.filter-section {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.filter-chip {
  padding: var(--space-2) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-transform: capitalize;
}

.filter-chip:hover {
  border-color: var(--primary);
  color: var(--text);
}

.filter-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* Articles Grid */
.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

.article-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-color: var(--primary);
}

.article-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.article-category {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.category-general { background: rgba(96, 165, 250, 0.2); color: #60A5FA; }
.category-billing { background: rgba(34, 197, 94, 0.2); color: #22C55E; }
.category-technical { background: rgba(168, 85, 247, 0.2); color: #A855F7; }
.category-sales { background: rgba(251, 146, 60, 0.2); color: #FB923C; }
.category-policies { background: rgba(156, 163, 175, 0.2); color: #9CA3AF; }

.article-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.article-card:hover .article-actions {
  opacity: 1;
}

.icon-btn {
  padding: var(--space-1);
  background: var(--surface-2);
  border: 1px solid var(--divider);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
  transform: scale(1.1);
}

.article-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.4;
}

.article-excerpt {
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0 0 var(--space-4) 0;
}

.article-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.tag {
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border: 1px solid var(--divider);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

.tag-more {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

.article-footer {
  display: flex;
  gap: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--divider);
}

.article-stat {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

.relevance-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  padding: var(--space-1) var(--space-2);
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-2xl);
  color: var(--text-subtle);
  margin-bottom: var(--space-6);
}

.empty-title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-2) 0;
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-muted);
  margin: 0;
}

/* Loading State */
.loading-state {
  padding: var(--space-6);
}

.shimmer-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

.shimmer-card {
  height: 260px;
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-xl);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-6);
}

.modal-card {
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-2xl);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: popIn var(--duration-normal) var(--ease-spring);
}

.modal-large {
  max-width: 800px;
}

.modal-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--divider);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  margin: 0;
  font-size: var(--text-2xl);
}

.article-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.meta-divider {
  color: var(--text-subtle);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}

.modal-close:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group label {
  display: block;
  font-weight: var(--weight-medium);
  margin-bottom: var(--space-2);
  color: var(--text);
}

.input-glass {
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-2);
  border: 1px solid var(--divider);
  border-radius: var(--radius-lg);
  color: var(--text);
  font-size: var(--text-base);
}

.input-glass:focus {
  outline: none;
  border-color: var(--primary);
}

textarea.input-glass {
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
}

select.input-glass {
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.article-content {
  line-height: 1.8;
  color: var(--text);
}

.article-content h1,
.article-content h2,
.article-content h3 {
  margin-top: var(--space-6);
  margin-bottom: var(--space-3);
  color: var(--text);
}

.article-content h1 { font-size: var(--text-3xl); }
.article-content h2 { font-size: var(--text-2xl); }
.article-content h3 { font-size: var(--text-xl); }

.article-tags-full {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--divider);
}

.modal-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--divider);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.btn-primary, .btn-secondary {
  padding: var(--space-3) var(--space-6);
  border: none;
  border-radius: var(--radius-lg);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--surface-2);
  color: var(--text-muted);
  border: 1px solid var(--divider);
}

.btn-secondary:hover {
  background: var(--surface-hover);
  color: var(--text);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
