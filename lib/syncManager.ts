import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from './localDb';
import { supabase } from './supabase';

let isOnline = true;
let syncInProgress = false;

// Monitor network status
export function initNetworkMonitoring() {
  NetInfo.addEventListener(state => {
    const wasOffline = !isOnline;
    isOnline = state.isConnected ?? false;
    
    console.log('Network status:', isOnline ? 'Online' : 'Offline');
    
    // If we just came back online, trigger sync
    if (wasOffline && isOnline) {
      console.log('Back online, triggering sync...');
      syncWithSupabase();
    }
  });
}

export function getNetworkStatus() {
  return isOnline;
}

// Add operation to sync queue
export async function queueSync(tableName: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', recordId: string, data: any) {
  const db = getDatabase();
  await db.runAsync(
    'INSERT INTO sync_queue (table_name, operation, record_id, data) VALUES (?, ?, ?, ?)',
    [tableName, operation, recordId, JSON.stringify(data)]
  );
}

// Sync local changes to Supabase
export async function syncWithSupabase() {
  if (!isOnline || syncInProgress) return;
  
  syncInProgress = true;
  const db = getDatabase();
  
  try {
    console.log('Starting sync...');
    
    // Get all pending sync operations
    const queue = await db.getAllAsync<{
      id: number;
      table_name: string;
      operation: string;
      record_id: string;
      data: string;
    }>('SELECT * FROM sync_queue ORDER BY id ASC');
    
    for (const item of queue) {
      try {
        const data = JSON.parse(item.data);
        
        switch (item.operation) {
          case 'INSERT':
            await supabase.from(item.table_name).insert(data);
            break;
          case 'UPDATE':
            await supabase.from(item.table_name).update(data).eq('id', item.record_id);
            break;
          case 'DELETE':
            await supabase.from(item.table_name).delete().eq('id', item.record_id);
            break;
        }
        
        // Remove from queue after successful sync
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
        console.log(`Synced ${item.operation} on ${item.table_name}`);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        // Keep in queue for retry
      }
    }
    
    // Pull latest data from Supabase
    await pullFromSupabase();
    
    console.log('Sync completed');
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    syncInProgress = false;
  }
}

// Pull data from Supabase to local
async function pullFromSupabase() {
  const db = getDatabase();
  
  try {
    // Sync tables
    const { data: tables, error: tablesError } = await supabase.from('tables').select('*');
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
    } else if (tables && tables.length > 0) {
      for (const table of tables) {
        // Validate required fields
        if (!table.table_number || !table.seats || !table.status) {
          console.warn('Skipping invalid table:', table.id);
          continue;
        }
        
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO tables (id, table_number, seats, status, current_order_id, synced, updated_at) 
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [table.id, table.table_number, table.seats, table.status, table.current_order_id || null, new Date().toISOString()]
          );
        } catch (err) {
          console.error('Error syncing table:', table.id, err);
        }
      }
    }
    
    // Sync menu_items
    const { data: menuItems, error: menuError } = await supabase.from('menu_items').select('*');
    if (menuError) {
      console.error('Error fetching menu items:', menuError);
    } else if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        // Validate required fields
        if (!item.name || !item.category || item.price === undefined) {
          console.warn('Skipping invalid menu item:', item.id);
          continue;
        }
        
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO menu_items (id, name, category, subcategory, meal_option, price, available, created_by, service_date, synced, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [item.id, item.name, item.category, item.subcategory || null, item.meal_option || null, item.price, item.available ? 1 : 0, item.created_by || null, item.service_date || null, new Date().toISOString()]
          );
        } catch (err) {
          console.error('Error syncing menu item:', item.id, err);
        }
      }
    }
    
    // Sync staff_profiles
    const { data: profiles, error: profilesError } = await supabase.from('staff_profiles').select('*');
    if (profilesError) {
      console.error('Error fetching staff profiles:', profilesError);
    } else if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        // Validate required fields
        if (!profile.name || !profile.role) {
          console.warn('Skipping invalid profile:', profile.id);
          continue;
        }
        
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO staff_profiles (id, name, role, synced, updated_at) 
             VALUES (?, ?, ?, 1, ?)`,
            [profile.id, profile.name, profile.role, new Date().toISOString()]
          );
        } catch (err) {
          console.error('Error syncing profile:', profile.id, err);
        }
      }
    }
    
    console.log('Pull from Supabase completed');
  } catch (error) {
    console.error('Error pulling from Supabase:', error);
  }
}

// Initial sync when app starts
export async function initialSync() {
  const state = await NetInfo.fetch();
  isOnline = state.isConnected ?? false;
  
  if (isOnline) {
    console.log('Performing initial sync...');
    // Don't await - let it run in background
    syncWithSupabase().catch(err => {
      console.error('Initial sync failed:', err);
    });
  } else {
    console.log('Starting in offline mode');
  }
}
