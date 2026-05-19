/**
 * POCKETBASE MIGRATION SCRIPT - MODULE 6: REPAYMENTS
 */
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';
dotenv.config();

const pb = new PocketBase(process.env.VITE_PB_URL || 'http://127.0.0.1:8090');

async function migrate() {
  try {
    console.log('Starting Repayment Module migration...');

    // 1. Create Repayment Schedule Collection
    const scheduleCollection = {
      name: 'repayment_schedule',
      type: 'base',
      schema: [
        { name: 'loan_application', type: 'relation', required: true, options: { collectionId: 'loan_applications', cascadeDelete: true, maxSelect: 1 } },
        { name: 'week_number', type: 'number', required: true },
        { name: 'due_date', type: 'date', required: true },
        { name: 'amount_due', type: 'number', required: true },
        { name: 'status', type: 'select', required: true, options: { values: ['upcoming', 'due', 'paid', 'overdue', 'missed'] }, default: 'upcoming' },
        { name: 'paid_at', type: 'date' },
        { name: 'amount_paid', type: 'number' },
        { name: 'received_by', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 } },
        { name: 'notes', type: 'text' },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""', // Usually system handles this but for now allow officers
      updateRule: '@request.auth.id != ""',
      deleteRule: 'null',
    };

    try {
      await pb.collections.create(scheduleCollection);
      console.log('Created repayment_schedule collection');
    } catch (e) { console.log('repayment_schedule might exist'); }

    console.log('Migration Module 6 Complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

migrate();
