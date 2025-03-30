// supabase-auth.js
// A module to handle Supabase authentication and user roles

// Initialize the Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Replace with your Supabase URL and public anon key
const supabaseUrl = 'https://dsqhmcjxgcwxcuincibs.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcWhtY2p4Z2N3eGN1aW5jaWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNzg0MjksImV4cCI6MjA1ODg1NDQyOX0.lTMJOniqzbgkpADjNUnPaDfdp7Ps_34GX9_2f9eBvXE'
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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session || !session.user) return null;

        const user = session.user;

        // Get user's role
        const role = await getUserRole(user.id);
        return { ...user, role };
    } catch (error) {
        console.error('Error getting current user:', error.message);
        return null;
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

// Check if current user is an admin
export async function isAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'admin')
    .maybeSingle();
    
  if (error || !data) return false;
  return true;
}

// Display admin features if user is admin
export async function setupAdminFeatures() {
  const adminElements = document.querySelectorAll('.admin-only');
  
  if (await isAdmin()) {
    adminElements.forEach(el => el.classList.remove('hidden'));
    
    // Load admin dashboards if they exist
    const adminDashboard = document.getElementById('admin-dashboard');
    if (adminDashboard) {
      await loadAdminDashboard();
    }
  } else {
    adminElements.forEach(el => el.classList.add('hidden'));
  }
}

// Load admin dashboard with all users and their roles
export async function loadAdminDashboard() {
  const usersContainer = document.getElementById('users-list');
  if (!usersContainer) return;
  
  try {
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
      
    if (profilesError) throw profilesError;
    
    // Get all user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');
      
    if (rolesError) throw rolesError;
    
    // Map roles to users
    const userRolesMap = {};
    userRoles.forEach(role => {
      if (!userRolesMap[role.user_id]) {
        userRolesMap[role.user_id] = [];
      }
      userRolesMap[role.user_id].push(role.role);
    });
    
    // Render users with their roles
    usersContainer.innerHTML = profiles.map(profile => {
      const roles = userRolesMap[profile.id] || [];
      const rolesBadges = roles.map(role => 
        `<span class="badge badge-${role}">${role}</span>`
      ).join('');
      
      return `
        <div class="user-card">
          <div class="user-info">
            <img src="${profile.avatar_url || '/images/default-avatar.jpg'}" alt="${profile.display_name || 'User'}">
            <div>
              <h3>${profile.display_name || profile.email || 'Unknown User'}</h3>
              <p>${profile.email || ''}</p>
              <div class="roles-container">${rolesBadges}</div>
            </div>
          </div>
          <div class="user-actions">
            <button data-user-id="${profile.id}" class="btn add-admin-btn ${roles.includes('admin') ? 'hidden' : ''}">Make Admin</button>
            <button data-user-id="${profile.id}" class="btn remove-admin-btn ${!roles.includes('admin') ? 'hidden' : ''}">Remove Admin</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners for admin role management
    document.querySelectorAll('.add-admin-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.userId;
        
        try {
          await supabase
            .from('user_roles')
            .insert([{ user_id: userId, role: 'admin' }]);
            
          // Refresh the dashboard
          loadAdminDashboard();
        } catch (error) {
          alert(`Error adding admin role: ${error.message}`);
        }
      });
    });
    
    document.querySelectorAll('.remove-admin-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.userId;
        
        try {
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role', 'admin');
            
          // Refresh the dashboard
          loadAdminDashboard();
        } catch (error) {
          alert(`Error removing admin role: ${error.message}`);
        }
      });
    });
    
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    usersContainer.innerHTML = `<p class="error">Error loading users: ${error.message}</p>`;
  }
}

// Call this on your admin pages
document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;
  
  // Setup admin features if user is an admin
  await setupAdminFeatures();
});

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}
