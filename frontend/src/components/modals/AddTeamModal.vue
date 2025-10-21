<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">Add New Team</h3>
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
                Team Name <span class="required">*</span>
              </label>
              <input
                v-model="formData.name"
                type="text"
                class="form-input"
                placeholder="e.g., Technical Support"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea
                v-model="formData.description"
                class="form-textarea"
                rows="3"
                placeholder="What does this team handle?"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Team Color</label>
              <div class="color-picker">
                <button
                  v-for="color in colors"
                  :key="color"
                  type="button"
                  @click="formData.color = color"
                  class="color-btn"
                  :class="{ active: formData.color === color }"
                  :style="{ backgroundColor: color }"
                >
                  <svg v-if="formData.color === color" class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Auto-assign Strategy</label>
              <select v-model="formData.assignStrategy" class="form-select">
                <option value="round_robin">Round Robin</option>
                <option value="load_balanced">Load Balanced</option>
                <option value="manual">Manual Assignment</option>
              </select>
            </div>

            <div class="form-group">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="formData.isActive"
                  type="checkbox"
                  class="form-checkbox"
                />
                <span class="form-label mb-0">Active (team can receive new conversations)</span>
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
                <span v-else>Create Team</span>
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
  (e: 'created', team: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const formData = ref({
  name: '',
  description: '',
  color: '#3b82f6',
  assignStrategy: 'load_balanced',
  isActive: true,
});

const colors = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const isSubmitting = ref(false);

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    resetForm();
  }
});

function close() {
  emit('update:modelValue', false);
}

function resetForm() {
  formData.value = {
    name: '',
    description: '',
    color: '#3b82f6',
    assignStrategy: 'load_balanced',
    isActive: true,
  };
}

async function handleSubmit() {
  isSubmitting.value = true;

  try {
    // TODO: API call to create team
    const newTeam = {
      id: Date.now(),
      ...formData.value,
      members: [],
      created_at: new Date().toISOString(),
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    emit('created', newTeam);
    close();
  } catch (error) {
    console.error('Failed to create team:', error);
    alert('Failed to create team. Please try again.');
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
  max-width: 500px;
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
  min-height: 80px;
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: white;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
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
  min-width: 120px;
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
}
</style>
