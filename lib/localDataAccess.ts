import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './localDb';
import { queueSync } from './syncManager';

// Menu Items
export async function getMenuItemsLocal(userId: string, serviceDate: string) {
  const db = getDatabase();
  const items = await db.getAllAsync(
    'SELECT * FROM menu_items WHERE created_by = ? AND service_date = ? ORDER BY name',
    [userId, serviceDate]
  );
  return items;
}

export async function getAllMenuItemsLocal() {
  const db = getDatabase();
  const items = await db.getAllAsync('SELECT * FROM menu_items ORDER BY service_date DESC, name');
  return items;
}

export async function insertMenuItemLocal(item: any) {
  const db = getDatabase();
  const id = item.id || uuidv4();
  
  await db.runAsync(
    `INSERT INTO menu_items (id, name, category, subcategory, meal_option, price, available, created_by, service_date, synced, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, item.name, item.category, item.subcategory || null, item.meal_option || null, item.price, item.available ? 1 : 0, item.created_by, item.service_date, new Date().toISOString()]
  );
  
  await queueSync('menu_items', 'INSERT', id, { ...item, id });
  return id;
}

export async function updateMenuItemLocal(id: string, updates: any) {
  const db = getDatabase();
  
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), new Date().toISOString(), id] as any[];
  
  await db.runAsync(
    `UPDATE menu_items SET ${fields}, synced = 0, updated_at = ? WHERE id = ?`,
    values
  );
  
  await queueSync('menu_items', 'UPDATE', id, updates);
}

export async function deleteMenuItemLocal(id: string) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM menu_items WHERE id = ?', [id]);
  await queueSync('menu_items', 'DELETE', id, {});
}

export async function deleteMenuItemsByDateLocal(userId: string, serviceDate: string) {
  const db = getDatabase();
  const items = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM menu_items WHERE created_by = ? AND service_date = ?',
    [userId, serviceDate]
  );
  
  for (const item of items) {
    await deleteMenuItemLocal(item.id);
  }
}

// Tables
export async function getTablesLocal() {
  const db = getDatabase();
  return await db.getAllAsync('SELECT * FROM tables ORDER BY table_number');
}

export async function updateTableLocal(id: string, updates: any) {
  const db = getDatabase();
  
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), new Date().toISOString(), id] as any[];
  
  await db.runAsync(
    `UPDATE tables SET ${fields}, synced = 0, updated_at = ? WHERE id = ?`,
    values
  );
  
  await queueSync('tables', 'UPDATE', id, updates);
}

// Staff Profiles
export async function getStaffProfilesLocal() {
  const db = getDatabase();
  return await db.getAllAsync('SELECT * FROM staff_profiles ORDER BY name');
}

export async function getStaffProfileByIdLocal(id: string) {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM staff_profiles WHERE id = ?', [id]);
}

// Reservations
export async function getReservationsLocal() {
  const db = getDatabase();
  return await db.getAllAsync('SELECT * FROM reservations ORDER BY reservation_time DESC');
}

export async function insertReservationLocal(reservation: any) {
  const db = getDatabase();
  const id = reservation.id || uuidv4();
  
  await db.runAsync(
    `INSERT INTO reservations (id, table_id, guest_name, guest_count, reservation_time, status, synced, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, reservation.table_id, reservation.guest_name, reservation.guest_count, reservation.reservation_time, reservation.status, new Date().toISOString()]
  );
  
  await queueSync('reservations', 'INSERT', id, { ...reservation, id });
  return id;
}

export async function updateReservationLocal(id: string, updates: any) {
  const db = getDatabase();
  
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), new Date().toISOString(), id] as any[];
  
  await db.runAsync(
    `UPDATE reservations SET ${fields}, synced = 0, updated_at = ? WHERE id = ?`,
    values
  );
  
  await queueSync('reservations', 'UPDATE', id, updates);
}

export async function deleteReservationLocal(id: string) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM reservations WHERE id = ?', [id]);
  await queueSync('reservations', 'DELETE', id, {});
}
