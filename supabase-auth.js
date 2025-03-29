// supabase-auth.js
// A module to handle Supabase authentication and user roles

// Initialize the Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Replace with your Supabase URL and public anon key
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseKey)

// Authentication functions
export async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error
    
    // Assign default role to new user
    if (data.user) {
      await assignRole(data.user.id, 'user')
    }
    
    return { success: true, data }
  } catch (error) {
    console.error('Error signing up:', error.message)
    return { success: false, error: error.message }
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    
    return { success: true, data }
  } catch (error) {
    console.error('Error signing in:', error.message)
    return { success: false, error: error.message }
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) throw error
    
    return { success: true }
  } catch (error) {
    console.error('Error signing out:', error.message)
    return { success: false, error: error.message }
  }
}

// Function to get the current logged-in user
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) throw error
    
    if (user) {
      // Get user's role
      const role = await getUserRole(user.id)
      return { ...user, role }
    }
    
    return null
  } catch (error) {
    console.error('Error getting current user:', error.message)
    return null
  }
}

// Role management functions
async function assignRole(userId, roleName) {
  try {
    // Insert into a custom 'user_roles' table
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: roleName })
    
    if (error) throw error
    
    return true
  } catch (error) {
    console.error('Error assigning role:', error.message)
    return false
  }
}

export async function getUserRole(userId) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()
    
    if (error) throw error
    
    return data?.role || 'user' // Default to 'user' if no role found
  } catch (error) {
    console.error('Error getting user role:', error.message)
    return 'user' // Default to 'user' on error
  }
}

export async function updateUserRole(userId, newRole) {
  try {
    // Check if current user is admin
    const currentUser = await getCurrentUser()
    if (currentUser.role !== 'admin') {
      throw new Error('Permission denied: Only admins can update roles')
    }
    
    return await assignRole(userId, newRole)
  } catch (error) {
    console.error('Error updating user role:', error.message)
    return false
  }
}

// Resource access control
export function checkAccess(requiredRole) {
  return async function(req, res, next) {
    try {
      const user = await getCurrentUser()
      
      if (!user) {
        return { allowed: false, message: 'Authentication required' }
      }
      
      // Get user role
      const userRole = user.role
      
      // Simple role hierarchy: admin > editor > user
      const roleHierarchy = {
        'admin': 3,
        'editor': 2,
        'user': 1
      }
      
      if (roleHierarchy[userRole] >= roleHierarchy[requiredRole]) {
        return { allowed: true }
      } else {
        return { 
          allowed: false, 
          message: `Permission denied: ${requiredRole} role required` 
        }
      }
    } catch (error) {
      console.error('Error checking access:', error.message)
      return { allowed: false, message: 'Error checking permissions' }
    }
  }
}

// Helper function to redirect unauthenticated users
export function redirectIfNotAuthenticated(redirectUrl = '/login.html') {
  getCurrentUser().then(user => {
    if (!user) {
      window.location.href = redirectUrl
    }
  })
}

// Init function to setup auth state listener
export function initAuth(onAuthStateChange) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (onAuthStateChange && typeof onAuthStateChange === 'function') {
      onAuthStateChange(event, session)
    }
    
    // Handle auth state changes
    if (event === 'SIGNED_IN') {
      console.log('User signed in')
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out')
    }
  })
}
