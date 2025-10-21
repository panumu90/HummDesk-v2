import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export interface User {
  id: string
  email: string
  name: string
  role: 'agent' | 'admin'
  teamId?: string
  avatar?: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  function initializeAuth() {
    const savedToken = localStorage.getItem('hummdesk_token')
    const savedUser = localStorage.getItem('hummdesk_user')

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = JSON.parse(savedUser)
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const response = await axios.post('/api/v1/auth/login', { email, password })
      const { access_token, user: newUser } = response.data

      token.value = access_token
      user.value = newUser

      localStorage.setItem('hummdesk_token', access_token)
      localStorage.setItem('hummdesk_user', JSON.stringify(newUser))
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      return true
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('hummdesk_token')
    localStorage.removeItem('hummdesk_user')
    delete axios.defaults.headers.common['Authorization']
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    initializeAuth,
    login,
    logout,
  }
})
