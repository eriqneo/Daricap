/**
 * POCKETBASE MIGRATION SCRIPT - MODULE 4: LOANS
 */
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';
dotenv.config();

const pb = new PocketBase(process.env.VITE_PB_URL || 'http://127.0.0.1:8090');

async function migrate() {
  try {
    console.log('Starting Loan Module migration...');

    // 1. Create Loan Applications Collection
    const loanAppsCollection = {
      name: 'loan_applications',
      type: 'base',
      schema: [
        { name: 'client', type: 'relation', required: true, options: { collectionId: 'clients', cascadeDelete: false, maxSelect: 1 } },
        { name: 'loan_product', type: 'select', required: true, options: { values: ['Daricap Pesa', 'Daricap Okoa'] } },
        { name: 'amount_requested', type: 'number', required: true },
        { name: 'repayment_weeks', type: 'number', required: true, options: { min: 2, max: 6 } },
        { name: 'interest_rate', type: 'number', required: true },
        { name: 'total_repayable', type: 'number', required: true },
        { name: 'weekly_installment', type: 'number', required: true },
        { name: 'status', type: 'select', required: true, options: { values: ['pending', 'approved', 'partially_approved', 'declined', 'disbursed'] }, default: 'pending' },
        { name: 'approved_amount', type: 'number' },
        { name: 'decline_reason', type: 'text' },
        { name: 'applied_by', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 } },
        { name: 'reviewed_by', type: 'relation', options: { collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 } },
        { name: 'applied_at', type: 'date', required: true },
        { name: 'disbursed_at', type: 'date' },
        { name: 'processing_fee_paid', type: 'bool', options: { default: false } },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && (@request.auth.role == "admin" || @request.auth.id == applied_by)',
      deleteRule: 'null',
    };

    // 2. Create Collaterals Collection
    const collateralsCollection = {
      name: 'collaterals',
      type: 'base',
      schema: [
        { name: 'loan_application', type: 'relation', required: true, options: { collectionId: 'loan_applications', cascadeDelete: true, maxSelect: 1 } },
        { name: 'owner_type', type: 'select', required: true, options: { values: ['borrower', 'guarantor'] } },
        { name: 'item_description', type: 'text', required: true },
        { name: 'estimated_value', type: 'number', required: true },
        { name: 'serial_number', type: 'text' },
        { name: 'document_upload', type: 'file', options: { maxSelect: 10, maxSize: 5242880 } },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: 'null',
    };

    // 3. Create Guarantors Collection
    const guarantorsCollection = {
      name: 'guarantors',
      type: 'base',
      schema: [
        { name: 'loan_application', type: 'relation', required: true, options: { collectionId: 'loan_applications', cascadeDelete: true, maxSelect: 1 } },
        { name: 'full_name', type: 'text', required: true },
        { name: 'national_id', type: 'text', required: true },
        { name: 'passport_photo', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
        { name: 'mobile', type: 'text', required: true },
        { name: 'relationship_to_borrower', type: 'text', required: true },
        { name: 'collateral_description', type: 'text' },
        { name: 'collateral_document', type: 'file', options: { maxSelect: 10, maxSize: 5242880 } },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: 'null',
    };

    try {
      await pb.collections.create(loanAppsCollection);
      console.log('Created loan_applications collection');
    } catch (e) { console.log('loan_applications might exist'); }

    try {
      await pb.collections.create(collateralsCollection);
      console.log('Created collaterals collection');
    } catch (e) { console.log('collaterals might exist'); }

    try {
      await pb.collections.create(guarantorsCollection);
      console.log('Created guarantors collection');
    } catch (e) { console.log('guarantors might exist'); }

    console.log('Migration Module 4 Complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

migrate();
