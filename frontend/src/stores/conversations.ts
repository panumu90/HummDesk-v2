import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'

export interface Message {
  id: string
  conversationId: string
  content: string
  sender: 'customer' | 'agent' | 'system'
  timestamp: Date
  agentId?: string
}

export interface AIClassification {
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  sentiment: 'positive' | 'neutral' | 'negative'
  assignedTeam?: string
  assignedAgent?: string
}

export interface AIDraft {
  content: string
  confidence: number
  reasoning: string
  suggestedActions?: string[]
}

export interface Assignee {
  id: string
  name: string
  avatar?: string
  currentLoad?: string
}

export interface Conversation {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  status: 'open' | 'pending' | 'closed'
  messages: Message[]
  assignedAgentId?: string
  assignedTeamId?: string
  assignee?: Assignee
  classification?: AIClassification
  aiDraft?: AIDraft
  createdAt: Date
  updatedAt: Date
}

export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const socket = ref<Socket | null>(null)

  const activeConversations = computed(() =>
    conversations.value.filter(c => c.status === 'open' || c.status === 'pending')
  )

  const closedConversations = computed(() =>
    conversations.value.filter(c => c.status === 'closed')
  )

  function initializeWebSocket() {
    if (socket.value) return

    socket.value = io('http://localhost:5000', {
      transports: ['websocket'],
      autoConnect: true,
    })

    socket.value.on('connect', () => {
      console.log('WebSocket connected')
    })

    socket.value.on('new_conversation', (conversation: Conversation) => {
      conversations.value.unshift(conversation)
    })

    socket.value.on('conversation_updated', (updated: Conversation) => {
      const index = conversations.value.findIndex(c => c.id === updated.id)
      if (index !== -1) {
        conversations.value[index] = updated
      }
      if (currentConversation.value?.id === updated.id) {
        currentConversation.value = updated
      }
    })

    socket.value.on('new_message', ({ conversationId, message }: { conversationId: string; message: Message }) => {
      const conversation = conversations.value.find(c => c.id === conversationId)
      if (conversation) {
        conversation.messages.push(message)
        conversation.updatedAt = new Date()
      }
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value.messages.push(message)
      }
    })

    socket.value.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })
  }

  async function fetchConversations() {
    loading.value = true
    error.value = null

    try {
      const response = await axios.get('/api/conversations')
      conversations.value = response.data.map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }))
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch conversations'
    } finally {
      loading.value = false
    }
  }

  async function fetchConversation(id: string) {
    loading.value = true
    error.value = null

    try {
      const response = await axios.get(`/api/conversations/${id}`)
      currentConversation.value = {
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt),
        messages: response.data.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }
      return currentConversation.value
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch conversation'
      return null
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(conversationId: string, content: string) {
    try {
      const response = await axios.post(`/api/conversations/${conversationId}/messages`, {
        content,
        sender: 'agent',
      })
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to send message'
      return null
    }
  }

  async function updateConversationStatus(conversationId: string, status: Conversation['status']) {
    try {
      const response = await axios.patch(`/api/conversations/${conversationId}`, { status })
      const index = conversations.value.findIndex(c => c.id === conversationId)
      if (index !== -1) {
        conversations.value[index] = response.data
      }
      if (currentConversation.value?.id === conversationId) {
        currentConversation.value = response.data
      }
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update conversation'
      return null
    }
  }

  async function assignConversation(conversationId: string, agentId: string) {
    try {
      const response = await axios.patch(`/api/conversations/${conversationId}/assign`, { agentId })
      const index = conversations.value.findIndex(c => c.id === conversationId)
      if (index !== -1) {
        conversations.value[index] = response.data
      }
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to assign conversation'
      return null
    }
  }

  function disconnectWebSocket() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  }

  return {
    conversations,
    currentConversation,
    loading,
    error,
    activeConversations,
    closedConversations,
    initializeWebSocket,
    fetchConversations,
    fetchConversation,
    sendMessage,
    updateConversationStatus,
    assignConversation,
    disconnectWebSocket,
  }
})
