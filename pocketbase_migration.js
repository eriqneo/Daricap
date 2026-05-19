/**
 * POCKETBASE MIGRATION SCRIPT
 * 
 * Instructions:
 * 1. Replace ADMIN_EMAIL and ADMIN_PASSWORD
 * 2. Run this script once using node: node pocketbase_migration.js
 */

import PocketBase from 'pocketbase';
import dotenv from 'dotenv';
dotenv.config();

const pb = new PocketBase(process.env.VITE_PB_URL || 'http://127.0.0.1:8090');

async function migrate() {
  try {
    // 1. Authenticate as Admin
    console.log('Authenticating as admin...');
    await pb.admins.authWithPassword('ADMIN_EMAIL', 'ADMIN_PASSWORD');

    // 2. Get Users collection
    console.log('Fetching users collection...');
    const collection = await pb.collections.getFirstListItem('name="users"');

    // 3. Add role field if it doesn't exist
    const hasRoleField = collection.schema.find(f => f.name === 'role');

    if (!hasRoleField) {
      console.log('Adding "role" field to users collection...');
      collection.schema.push({
        name: 'role',
        type: 'select',
        required: true,
        options: {
          values: ['admin', 'loan_officer']
        }
      });

      await pb.collections.update(collection.id, collection);
      console.log('Migration successful: "role" field added.');
    } else {
      console.log('Migration skipped: "role" field already exists.');
    }

  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.message.includes('401')) {
      console.error('Tip: Ensure you provided the correct ADMIN_EMAIL and ADMIN_PASSWORD.');
    }
  }
}

migrate();
