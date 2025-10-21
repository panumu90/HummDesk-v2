<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">New Conversation</h3>
            <button @click="close" class="close-btn">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <form @submit.prevent="handleSubmit" class="modal-body">
            <div class="form-group">
              <label class="form-label">
                Customer Email <span class="required">*</span>
              </label>
              <input
                v-model="formData.customerEmail"
                type="email"
                class="form-input"
                placeholder="customer@example.com"
                required
              />
              <p v-if="customerContext" class="customer-info">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                {{ customerContext.name }} - {{ customerContext.tier }} tier
              </p>
            </div>

            <div class="form-group">
              <label class="form-label">
                Subject <span class="required">*</span>
              </label>
              <input
                v-model="formData.subject"
                type="text"
                class="form-input"
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                Message <span class="required">*</span>
              </label>
              <textarea
                v-model="formData.message"
                class="form-textarea"
                rows="6"
                placeholder="Describe the customer's issue or question..."
                required
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select v-model="formData.priority" class="form-select">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Category</label>
                <select v-model="formData.category" class="form-select">
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="sales">Sales</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Assign to Team</label>
              <select v-model="formData.teamId" class="form-select">
                <option :value="null">Auto-assign (AI will decide)</option>
                <option v-for="team in teams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>
            </div>

            <div class="ai-suggestion" v-if="aiSuggestion">
              <div class="suggestion-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <div class="suggestion-content">
                <h5>AI Suggestion</h5>
                <p>{{ aiSuggestion }}</p>
              </div>
            </div>

            <div class="form-group">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="formData.autoClassify"
                  type="checkbox"
                  class="form-checkbox"
                />
                <span class="form-label mb-0">Use AI to classify and assign automatically</span>
              </label>
            </div>

            <div class="modal-footer">
              <button type="button" @click="close" class="btn-secondary">
                Cancel
              </button>
              <button type="submit" class="btn-primary" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="flex items-center gap-2">
                  <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
                <span v-else>Create Conversation</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  modelValue: boolean;
}

interface Emit {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', conversation: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const formData = ref({
  customerEmail: '',
  subject: '',
  message: '',
  priority: 'normal',
  category: 'general',
  teamId: null as number | null,
  autoClassify: true,
});

const customerContext = ref<any>(null);
const aiSuggestion = ref<string | null>(null);
const isSubmitting = ref(false);

// Mock teams - in production, fetch from API
const teams = ref([
  { id: 1, name: 'Billing Team' },
  { id: 2, name: 'Technical Support' },
  { id: 3, name: 'Sales Team' },
]);

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    resetForm();
  }
});

watch(() => formData.value.customerEmail, async (email) => {
  if (email && email.includes('@')) {
    // Simulate fetching customer context from HubSpot
    await new Promise(resolve => setTimeout(resolve, 300));
    customerContext.value = {
      name: 'John Doe',
      tier: 'Premium',
    };
  } else {
    customerContext.value = null;
  }
});

watch([
  () => formData.value.subject,
  () => formData.value.message,
  () => formData.value.category,
], () => {
  generateAISuggestion();
});

function generateAISuggestion() {
  const { subject, message, category } = formData.value;

  if (!subject && !message) {
    aiSuggestion.value = null;
    return;
  }

  // Mock AI suggestions based on content
  if (category === 'billing' || subject.toLowerCase().includes('invoice') || message.toLowerCase().includes('payment')) {
    aiSuggestion.value = 'This looks like a billing issue. Recommended: Billing Team, Priority: High';
  } else if (category === 'technical' || message.toLowerCase().includes('error') || message.toLowerCase().includes('broken')) {
    aiSuggestion.value = 'Technical issue detected. Recommended: Technical Support Team, Priority: High';
  } else if (category === 'sales' || message.toLowerCase().includes('pricing') || message.toLowerCase().includes('quote')) {
    aiSuggestion.value = 'Sales inquiry detected. Recommended: Sales Team, Priority: Normal';
  } else {
    aiSuggestion.value = 'AI will automatically classify based on content when created.';
  }
}

function close() {
  emit('update:modelValue', false);
}

function resetForm() {
  formData.value = {
    customerEmail: '',
    subject: '',
    message: '',
    priority: 'normal',
    category: 'general',
    teamId: null,
    autoClassify: true,
  };
  customerContext.value = null;
  aiSuggestion.value = null;
}

async function handleSubmit() {
  isSubmitting.value = true;

  try {
    // Step 1: Find or create contact by email
    const contactResponse = await fetch(`http://localhost:5000/api/v1/contacts/find-or-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        email: formData.value.customerEmail,
        name: customerContext.value?.name || formData.value.customerEmail.split('@')[0],
      }),
    });

    if (!contactResponse.ok) {
      throw new Error('Failed to create/find contact');
    }

    const contact = await contactResponse.json();

    // Step 2: Create conversation with inbox_id = 1 (demo inbox)
    const conversationResponse = await fetch(`http://localhost:5000/api/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        inbox_id: 1, // Demo inbox
        contact_id: contact.id,
        subject: formData.value.subject,
        priority: formData.value.priority,
        metadata: {
          category: formData.value.category,
          auto_classify: formData.value.autoClassify,
          team_id: formData.value.teamId,
        },
      }),
    });

    if (!conversationResponse.ok) {
      throw new Error('Failed to create conversation');
    }

    const newConversation = await conversationResponse.json();

    // Step 3: Send initial message
    const messageResponse = await fetch(`http://localhost:5000/api/v1/conversations/${newConversation.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        content: formData.value.message,
        sender_type: 'Contact',
      }),
    });

    if (!messageResponse.ok) {
      console.warn('Failed to send initial message, but conversation was created');
    }

    emit('created', newConversation);
    close();
  } catch (error) {
    console.error('Failed to create conversation:', error);
    alert('Failed to create conversation. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background: rgba(15, 23, 42, 0.98);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.1);
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.required {
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 10px 14px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(30, 41, 59, 0.8);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 6px;
  color: #22c55e;
  font-size: 13px;
}

.ai-suggestion {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  margin-bottom: 20px;
}

.suggestion-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.suggestion-content h5 {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 4px;
}

.suggestion-content p {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.5;
}

.form-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid rgba(148, 163, 184, 0.3);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  min-width: 160px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.btn-secondary:hover {
  background: rgba(148, 163, 184, 0.2);
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9);
}

/* Responsive */
@media (max-width: 640px) {
  .modal-container {
    max-width: none;
    margin: 0;
  }

  .modal-header,
  .modal-body {
    padding: 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
