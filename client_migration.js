/**
 * POCKETBASE MIGRATION SCRIPT - MODULE 3: CLIENTS
 */
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';
dotenv.config();

const pb = new PocketBase(process.env.VITE_PB_URL || 'http://127.0.0.1:8090');

async function migrate() {
  try {
    // 1. Authenticate as Admin (if you have real credentials)
    // For now, these are placeholders.
    // await pb.admins.authWithPassword('ADMIN_EMAIL', 'ADMIN_PASSWORD');

    console.log('Starting Client Module migration...');

    // 2. Create Clients Collection
    const clientsCollection = {
      name: 'clients',
      type: 'base',
      schema: [
        { name: 'title', type: 'select', required: true, options: { values: ['Mr', 'Mrs', 'Ms'] } },
        { name: 'first_name', type: 'text', required: true },
        { name: 'middle_name', type: 'text', required: true },
        { name: 'surname', type: 'text', required: true },
        { name: 'gender', type: 'select', required: true, options: { values: ['M', 'F'] } },
        { name: 'national_id', type: 'text', required: true, unique: true },
        { name: 'kra_pin', type: 'text' },
        { name: 'residence', type: 'text' },
        { name: 'mobile', type: 'text', required: true },
        { name: 'alt_mobile', type: 'text' },
        { name: 'passport_photo', type: 'file', options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png'] } },
        { name: 'registration_fee_paid', type: 'bool', options: { default: false } },
        { name: 'registration_fee_amount', type: 'number' },
        { name: 'registered_by', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 } },
        { name: 'referee_1_name', type: 'text' },
        { name: 'referee_1_relationship', type: 'text' },
        { name: 'referee_1_phone', type: 'text' },
        { name: 'referee_2_name', type: 'text' },
        { name: 'referee_2_relationship', type: 'text' },
        { name: 'referee_2_phone', type: 'text' },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: 'null',
    };

    // 3. Create Registration Payments Collection
    const paymentsCollection = {
      name: 'registration_payments',
      type: 'base',
      schema: [
        { name: 'client', type: 'relation', options: { collectionId: 'clients', cascadeDelete: true, maxSelect: 1 } },
        { name: 'amount', type: 'number', required: true },
        { name: 'paid_at', type: 'date', required: true },
        { name: 'received_by', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 } },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: 'null',
      deleteRule: 'null',
    };

    // Try to create or update
    try {
      await pb.collections.create(clientsCollection);
      console.log('Created clients collection');
    } catch (e) {
      console.log('Clients collection might exist, skipping creation.');
    }

    try {
      await pb.collections.create(paymentsCollection);
      console.log('Created registration_payments collection');
    } catch (e) {
      console.log('Registration Payments collection might exist, skipping creation.');
    }

    console.log('Migration Module 3 Complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

migrate();

