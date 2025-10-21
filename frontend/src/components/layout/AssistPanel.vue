<template>
  <div class="assist-panel">
    <div class="assist-header">
      <h2 class="assist-title">AI Assistant</h2>
      <button class="close-btn" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="assist-content">
      <!-- AI Classification -->
      <div class="assist-section">
        <h3 class="section-title">Classification</h3>
        <div class="classification-grid">
          <div class="classification-item">
            <span class="classification-label">Category</span>
            <span class="classification-value chip chip-primary">Billing</span>
          </div>
          <div class="classification-item">
            <span class="classification-label">Priority</span>
            <span class="classification-value chip chip-warning">High</span>
          </div>
          <div class="classification-item">
            <span class="classification-label">Sentiment</span>
            <span class="classification-value chip chip-success">Positive</span>
          </div>
          <div class="classification-item">
            <span class="classification-label">Confidence</span>
            <span class="classification-value">94%</span>
          </div>
        </div>
      </div>

      <!-- Suggested Actions -->
      <div class="assist-section">
        <h3 class="section-title">Suggested Actions</h3>
        <div class="actions-list">
          <button class="action-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0z" stroke="currentColor" stroke-width="2"/>
              <path d="M10 6L7 9l-2-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Assign to Billing Team</span>
          </button>
          <button class="action-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM5 6h6M5 10h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Use Draft Response</span>
          </button>
          <button class="action-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Create Follow-up Task</span>
          </button>
        </div>
      </div>

      <!-- Knowledge Base Matches -->
      <div class="assist-section">
        <h3 class="section-title">Related Articles</h3>
        <div class="kb-list">
          <a href="#" class="kb-item">
            <svg class="kb-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 5.5v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M2 5.5h12a1 1 0 0 1 1 1V13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13V6.5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <div class="kb-content">
              <span class="kb-title">Billing FAQ - Invoice Issues</span>
              <span class="kb-match">92% match</span>
            </div>
          </a>
          <a href="#" class="kb-item">
            <svg class="kb-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 5.5v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M2 5.5h12a1 1 0 0 1 1 1V13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13V6.5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <div class="kb-content">
              <span class="kb-title">Payment Processing Guide</span>
              <span class="kb-match">87% match</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Draft Response -->
      <div class="assist-section">
        <h3 class="section-title">AI Draft Response</h3>
        <div class="draft-container">
          <p class="draft-text">
            Hi Sarah,

            I understand you're experiencing issues with your invoice. I've reviewed your account and can see the duplicate charge you mentioned.

            I've immediately processed a refund for the duplicate amount of $49.99, which should appear in your account within 3-5 business days.

            Is there anything else I can help you with today?

            Best regards
          </p>
          <div class="draft-actions">
            <button class="btn-secondary">Edit Draft</button>
            <button class="btn-primary">Use Draft</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(['close'])
</script>

<style scoped>
.assist-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.assist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--divider);
}

.assist-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.close-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.assist-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Sections */
.assist-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

/* Classification */
.classification-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.classification-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--divider);
  border-radius: var(--radius-lg);
}

.classification-label {
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

.classification-value {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--text);
}

.chip {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  width: fit-content;
}

.chip-primary {
  background: var(--primary);
  color: white;
}

.chip-warning {
  background: var(--warning);
  color: var(--bg);
}

.chip-success {
  background: var(--success);
  color: white;
}

/* Actions */
.actions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-align: left;
}

.action-btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  transform: translateX(2px);
  box-shadow: var(--shadow-sm);
}

.action-btn svg {
  flex-shrink: 0;
  color: var(--accent);
}

/* Knowledge Base */
.kb-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.kb-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-out);
}

.kb-item:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  transform: translateX(2px);
}

.kb-icon {
  flex-shrink: 0;
  color: var(--accent);
}

.kb-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.kb-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text);
}

.kb-match {
  font-size: var(--text-xs);
  color: var(--success);
}

/* Draft */
.draft-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.draft-text {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text);
  margin: 0;
  white-space: pre-line;
}

.draft-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-secondary,
.btn-primary {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn-secondary:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.btn-primary {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--bg);
}

.btn-primary:hover {
  background: var(--primary);
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}
</style>
