import { createStore, get, set, del, update, values, keys } from 'idb-keyval';

// Initialize Stores
const usersStore = createStore('daricap_users_db', 'keyval');
const clientsStore = createStore('daricap_clients_db', 'keyval');
const loansStore = createStore('daricap_loans_db', 'keyval');
const collateralsStore = createStore('daricap_collaterals_db', 'keyval');
const guarantorsStore = createStore('daricap_guarantors_db', 'keyval');
const repaymentsStore = createStore('daricap_repayments_db', 'keyval');
const paymentsStore = createStore('daricap_payments_db', 'keyval');
const settingsStore = createStore('daricap_settings_db', 'keyval');
const sessionStore = createStore('daricap_session_db', 'keyval');
const notificationsStore = createStore('daricap_notifications_db', 'keyval');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

const db = {
  // AUTH
  _normalizeClient(c) {
    if (!c) return null;
    const feePaid = c.registrationFeePaid 
                 || c.registration_fee_paid 
                 || c.fee_status === 'paid' 
                 || false;
    
    return {
      ...c,
      registrationFeePaid: feePaid,
      registration_fee_paid: feePaid,
      registrationStatus: feePaid ? 'complete' : 'incomplete',
      registration_status: feePaid ? 'complete' : 'incomplete',
      fee_status: feePaid ? 'paid' : 'unpaid',
      mobile: c.mobile || c.mobileNumber || c.phone || c.mobile_number || c.phone_number || '',
      nationalId: c.nationalId || c.national_id || c.nationalID || '',
      firstName: c.firstName || c.first_name || '',
      surname: c.surname || c.lastName || c.last_name || '',
    };
  },

  async seedUsers() {
    const allUsers = await values(usersStore);
    if (allUsers.length === 0) {
      const admin = {
        id: generateId(),
        name: 'Admin User',
        email: 'admin@daricap.co.ke',
        password: 'admin123',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      const officer = {
        id: generateId(),
        name: 'James Kariuki',
        email: 'officer@daricap.co.ke',
        password: 'officer123',
        role: 'loan_officer',
        createdAt: new Date().toISOString()
      };
      await set(admin.id, admin, usersStore);
      await set(officer.id, officer, usersStore);
    }
    await this.seedDemoData();
  },

  async seedDemoData() {
    const allClients = await values(clientsStore);
    if (allClients.length > 0) return;

    const users = await values(usersStore);
    const officer = users.find(u => u.role === 'loan_officer');
    if (!officer) return;

    // 1. Sample client complete with processing fee
    const client1 = await this.saveClient({
      first_name: 'John',
      surname: 'Doe',
      national_id: '12345678',
      mobile: '0711223344',
      residence: 'Nakuru Town',
      fee_status: 'paid',
      created_by: officer.id,
      created_by_name: officer.name
    });
    await this.recordProcessingFee(client1.id, 500, new Date().toISOString(), officer.id);
    await this.updateClientStatus(client1.id);

    // 2. Sample client complete but no processing fee
    const client2 = await this.saveClient({
      first_name: 'Alice',
      surname: 'Wambui',
      national_id: '87654321',
      mobile: '0722334455',
      residence: 'Njoro',
      fee_status: 'paid',
      created_by: officer.id,
      created_by_name: officer.name
    });
    await this.updateClientStatus(client2.id);

    // 3. Add 10 more random clients for testing
    const firstNames = ['Samuel', 'Mary', 'David', 'Jane', 'Kevin', 'Sarah', 'Peter', 'Grace', 'Michael', 'Lucy'];
    const lastNames = ['Omondi', 'Karanja', 'Maina', 'Wanjiku', 'Njoroge', 'Mwikali', 'Muthoni', 'Kamau', 'Achieng', 'Otieno'];
    for (let i = 0; i < 10; i++) {
      const isPaid = Math.random() > 0.4;
      await this.saveClient({
        first_name: firstNames[i],
        surname: lastNames[i],
        national_id: (Math.floor(10000000 + Math.random() * 90000000)).toString(),
        mobile: '07' + (Math.floor(10000000 + Math.random() * 90000000)).toString(),
        residence: 'Random Location ' + (i + 1),
        fee_status: isPaid ? 'paid' : 'unpaid',
        created_by: officer.id,
        created_by_name: officer.name
      });
    }

    // 4. Sample loan application (pending)
    await this.saveLoan({
      clientId: client1.id,
      loan_product: 'Daricap Pesa',
      amount_requested: 10000,
      repayment_weeks: 4,
      interest_rate: 0.20,
      total_repayable: 12000,
      installment_amount: 3000,
      applied_by: officer.id,
      applied_at: new Date().toISOString()
    });

    // 4. Sample disbursed loan
    const disbursedLoan = await this.saveLoan({
      clientId: client2.id,
      loan_product: 'Daricap Okoa',
      amount_requested: 5000,
      repayment_weeks: 2,
      interest_rate: 0.15,
      total_repayable: 5750,
      installment_amount: 2875,
      applied_by: officer.id,
      applied_at: new Date().toISOString(),
      status: 'disbursed',
      disbursed_at: new Date().toISOString()
    });
    await this.generateSchedule(disbursedLoan.id);
  },

  async login(email, password) {
    const allUsers = await values(usersStore);
    const user = allUsers.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Invalid credentials');
    
    const session = { ...user };
    delete session.password;
    await set('current_user', session, sessionStore);
    return session;
  },

  async logout() {
    try {
      await del('current_user', sessionStore);
    } catch (e) {
      console.warn('IDB session clear failed:', e);
    }
    
    // Delegate to auth.js logout for localStorage + redirect if called from outside
    if (window.handleLogout && !window._inLogoutDelegate) {
      window._inLogoutDelegate = true;
      window.handleLogout();
      delete window._inLogoutDelegate;
    }
  },

  async getSession() {
    return await get('current_user', sessionStore) || null;
  },

  async updateSession(user) {
    const session = { ...user };
    delete session.password;
    await set('current_user', session, sessionStore);
    return session;
  },

  async getUsers() {
    return await values(usersStore);
  },

  async getUserById(id) {
    return await get(id, usersStore) || null;
  },

  async saveUser(data) {
    const id = data.id || generateId();
    const user = {
      ...data,
      id,
      createdAt: data.createdAt || new Date().toISOString()
    };
    await set(id, user, usersStore);
    return user;
  },

  async deleteUser(id) {
    await del(id, usersStore);
  },

  async updateUser(id, changes) {
    const existing = await get(id, usersStore);
    if (!existing) throw new Error('User not found');
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    await set(id, updated, usersStore);
    return updated;
  },

  // SETTINGS
  async getSetting(key, defaultValue = null) {
    return await get(key, settingsStore) ?? defaultValue;
  },

  async setSetting(key, value) {
    await set(key, value, settingsStore);
  },

  async getCompanyLogo() {
    return await this.getSetting('companyLogo', null);
  },

  async setCompanyLogo(base64) {
    await this.setSetting('companyLogo', base64);
  },

  async getCompanyName() {
    return await this.getSetting('companyName', 'DariCap Network');
  },

  async setCompanyName(name) {
    await this.setSetting('companyName', name);
  },

  async getSettings() {
    const allKeys = await keys(settingsStore);
    const settings = {};
    for (const key of allKeys) {
      settings[key] = await get(key, settingsStore);
    }
    // Set defaults if empty
    if (Object.keys(settings).length === 0) {
      return { registrationFee: 150, declinedAfterMonths: 3, processingFee: 500 };
    }
    return settings;
  },

  // CLIENTS
  async saveClient(data) {
    const id = data.id || generateId();
    
    // Resolve fee paid from any variant
    const feePaid = data.registrationFeePaid === true 
                 || data.registration_fee_paid === true
                 || data.fee_status === 'paid';
    
    // Use passed status if explicitly set, otherwise derive from feePaid
    const passedStatus = data.registrationStatus || data.registration_status;
    const resolvedStatus = passedStatus 
      ? passedStatus                              // trust what the form sends
      : (feePaid ? 'complete' : 'incomplete');   // fallback derivation
    
    const clientRecord = {
      ...data,
      id,
      createdAt: data.createdAt || new Date().toISOString(),
      
      // Normalize registration fee field — store BOTH forms
      registrationFeePaid: feePaid,
      registration_fee_paid: feePaid,
      fee_status: feePaid ? 'paid' : 'unpaid',
      
      registrationStatus: resolvedStatus,
      registration_status: resolvedStatus,

      // Normalize contact fields
      mobile: data.mobile || data.mobileNumber || data.phone || data.mobile_number || '',
      nationalId: data.nationalId || data.national_id || data.nationalID || '',
      firstName: data.firstName || data.first_name || '',
      surname: data.surname || data.lastName || data.last_name || '',

      processing_fee_paid: data.processing_fee_paid || false,
      processing_fee_amount: data.processing_fee_amount || null,
      processing_fee_date: data.processing_fee_date || null,
      processing_fee_received_by: data.processing_fee_received_by || null,
    };
    await set(id, clientRecord, clientsStore);
    return clientRecord;
  },

  async markRegistrationComplete(clientId, feeAmount, feeDate, receivedBy) {
    const existing = await get(clientId, clientsStore);
    if (!existing) throw new Error('Client not found: ' + clientId);
    
    const updated = {
      ...existing,
      registrationFeePaid: true,
      registration_fee_paid: true,
      fee_status: 'paid',
      registrationFeeAmount: feeAmount,
      registration_fee_amount: feeAmount,
      registrationFeeDate: feeDate || new Date().toISOString(),
      registrationFeeReceivedBy: receivedBy,
      registrationStatus: 'complete',
      registration_status: 'complete',
      updatedAt: new Date().toISOString()
    };
    
    await set(clientId, updated, clientsStore);
    return this._normalizeClient(updated);
  },

  async updateClient(id, data) {
    await update(id, (val) => ({ ...val, ...data, updatedAt: new Date().toISOString() }), clientsStore);
    await this.updateClientStatus(id);
    return await get(id, clientsStore);
  },

  async getClientRegistrationStatus(clientId) {
    const client = await get(clientId, clientsStore);
    if (!client) return 'not_found';
    return client.registration_status || 'incomplete';
  },

  async updateClientStatus(clientId) {
    const client = await get(clientId, clientsStore);
    if (!client) return;

    const hasRequiredFields = client.firstName && client.surname && client.nationalId && client.mobile;
    const isFeePaid = client.registrationFeePaid === true;

    const newStatus = (hasRequiredFields && isFeePaid) ? 'complete' : 'incomplete';
    
    if (client.registrationStatus !== newStatus || client.registration_status !== newStatus) {
      await update(clientId, (val) => ({ 
        ...val, 
        registrationStatus: newStatus,
        registration_status: newStatus 
      }), clientsStore);
    }
  },

  async recordProcessingFee(clientId, amount, date, receivedByUserId) {
    await update(clientId, (val) => ({
      ...val,
      processing_fee_paid: true,
      processing_fee_amount: amount,
      processing_fee_date: date || new Date().toISOString(),
      processing_fee_received_by: receivedByUserId
    }), clientsStore);
    return await get(clientId, clientsStore);
  },

  async getProcessingFeeStatus(clientId) {
    const client = await get(clientId, clientsStore);
    if (!client) return { paid: false };
    return {
      paid: client.processing_fee_paid || false,
      amount: client.processing_fee_amount,
      date: client.processing_fee_date,
      receivedBy: client.processing_fee_received_by
    };
  },

  async getClient(id) {
    const client = await get(id, clientsStore);
    return this._normalizeClient(client);
  },

  async getClients(filters = {}) {
    let all = await values(clientsStore);
    all = all.map(c => this._normalizeClient(c));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      all = all.filter(c => 
        (c.firstName + ' ' + c.surname).toLowerCase().includes(q) ||
        (c.nationalId && c.nationalId.includes(q)) ||
        (c.mobile && c.mobile.includes(q))
      );
    }
    if (filters.officerId) {
      all = all.filter(c => c.created_by === filters.officerId);
    }
    if (filters.feeStatus) {
      all = all.filter(c => c.fee_status === filters.feeStatus);
    }
    if (filters.dateFrom) {
      all = all.filter(c => c.createdAt >= filters.dateFrom);
    }
    if (filters.dateTo) {
      all = all.filter(c => c.createdAt <= filters.dateTo);
    }
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async deleteClient(id) {
    await del(id, clientsStore);
  },

  // LOANS
  _normalizeLoan(loan) {
    if (!loan) return null;
    
    const VALID_PRODUCTS = ['Daricap Pesa', 'Daricap Okoa'];
    const rawProduct = loan.loanProduct 
                    || loan.loan_product 
                    || loan.product 
                    || '';
    
    const product = VALID_PRODUCTS.includes(rawProduct) ? rawProduct : 'Daricap Pesa';
    
    return {
      ...loan,
      loanProduct: product,
      loan_product: product,
      product: product,
      clientId: loan.clientId || loan.client_id || '',
      repaymentWeeks: loan.repaymentWeeks || loan.repayment_weeks || 2,
      interestRate: loan.interestRate || loan.interest_rate || 0.15,
      totalRepayable: loan.totalRepayable || loan.total_repayable || 0,
      installmentAmount: loan.installmentAmount || loan.installment_amount || 0,
      appliedBy: loan.appliedBy || loan.applied_by || '',
      appliedAt: loan.appliedAt || loan.applied_at || loan.createdAt || new Date().toISOString(),
    };
  },

  async saveLoan(data) {
    const loanRecord = this._normalizeLoan({
      ...data,
      id: data.id || generateId(),
      status: data.status || 'pending',
      createdAt: data.createdAt || new Date().toISOString(),
    });

    await set(loanRecord.id, loanRecord, loansStore);
    return loanRecord;
  },

  async updateLoan(id, data) {
    await update(id, (val) => ({ ...val, ...data, updatedAt: new Date().toISOString() }), loansStore);
    return await this.getLoan(id);
  },

  async getLoan(id) {
    const loan = await get(id, loansStore);
    if (!loan) return null;
    const normalized = this._normalizeLoan(loan);
    const client = await this.getClient(normalized.clientId);
    return { ...normalized, client };
  },

  async getLoans(filters = {}) {
    let all = await values(loansStore);
    all = all.map(l => this._normalizeLoan(l));

    if (filters.status) all = all.filter(l => l.status === filters.status);
    if (filters.clientId) all = all.filter(l => l.clientId === filters.clientId);
    if (filters.officerId) all = all.filter(l => l.appliedBy === filters.officerId);
    if (filters.dateFrom) all = all.filter(l => l.createdAt >= filters.dateFrom);
    if (filters.dateTo) all = all.filter(l => l.createdAt <= filters.dateTo);
    
    // Join client data
    const results = [];
    for (const l of all) {
      const client = await this.getClient(l.clientId);
      results.push({ ...l, client });
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getPendingLoans() {
    return await this.getLoans({ status: 'pending' });
  },

  async getActiveLoans() {
    const all = await this.getLoans({ status: 'disbursed' });
    // Filter out fully repaid ones
    const active = [];
    for (const loan of all) {
      const schedule = await this.getSchedule(loan.id);
      const isPaid = schedule.every(s => s.status === 'paid');
      if (!isPaid) active.push(loan);
    }
    return active;
  },

  // COLLATERALS & GUARANTORS
  async saveCollateral(data) {
    const id = generateId();
    const col = { ...data, id, createdAt: new Date().toISOString() };
    await set(id, col, collateralsStore);
    return col;
  },

  async getCollaterals(loanId) {
    const all = await values(collateralsStore);
    return all.filter(c => c.loanId === loanId);
  },

  async saveGuarantor(data) {
    const id = generateId();
    const g = { ...data, id, createdAt: new Date().toISOString() };
    await set(id, g, guarantorsStore);
    return g;
  },

  async getGuarantor(loanId) {
    const all = await values(guarantorsStore);
    const g = all.find(g => g.loanId === loanId);
    if (!g) return null;
    return {
      ...g,
      passport_photo: g.photo || null // ensuring fallback
    };
  },

  async checkGuarantorEligibility(nationalId) {
    // Check 1: Is this ID currently an active borrower?
    const clients = await this.getClients({});
    const matchingClient = clients.find(c =>
      c.nationalId === nationalId || c.national_id === nationalId
    );

    if (matchingClient) {
      const activeLoans = await this.getLoans({ clientId: matchingClient.id });
      const hasActiveLoan = activeLoans.some(l =>
        ['pending', 'approved', 'partially_approved', 'disbursed'].includes(l.status)
      );
      if (hasActiveLoan) {
        return {
          eligible: false,
          reason: `${matchingClient.first_name} ${matchingClient.surname} is currently an active borrower and cannot be a guarantor at the same time.`
        };
      }
    }

    // Check 2: Is this ID already guaranteeing an active loan?
    const allLoans = await this.getLoans({});
    for (const loan of allLoans) {
      if (!['pending', 'approved', 'partially_approved', 'disbursed'].includes(loan.status)) {
        continue;
      }
      const guarantor = await this.getGuarantor(loan.id);
      if (guarantor && (guarantor.nationalId === nationalId ||
        guarantor.national_id === nationalId)) {
        const borrowerClient = await this.getClient(loan.clientId);
        const borrowerName = borrowerClient
          ? `${borrowerClient.first_name} ${borrowerClient.surname}`
          : 'another client';
        return {
          eligible: false,
          reason: `This person is already guaranteeing an active loan for ${borrowerName}. A guarantor can only support one loan at a time.`
        };
      }
    }

    return { eligible: true, reason: null };
  },

  // REPAYMENTS
  async generateSchedule(loanId) {
    const loan = await get(loanId, loansStore);
    if (!loan) return;
    
    const disbursedAt = loan.disbursed_at || new Date().toISOString();
    const weeks = loan.repayment_weeks || 4;
    const amountDue = (loan.total_repayable || (loan.amount_requested * 1.25)) / weeks;

    const schedule = [];
    for (let i = 1; i <= weeks; i++) {
        const dueDate = new Date(disbursedAt);
        dueDate.setDate(dueDate.getDate() + (i * 7 - 1));
        
        const row = {
            id: generateId(),
            loanId,
            week: i,
            due_date: dueDate.toISOString(),
            amount_due: amountDue,
            amount_paid: 0,
            status: 'unpaid',
        };
        await set(row.id, row, repaymentsStore);
        schedule.push(row);
    }
    return schedule;
  },

  async getSchedule(loanId) {
    const all = await values(repaymentsStore);
    return all.filter(r => r.loanId === loanId).sort((a, b) => a.week - b.week);
  },

  async recordPayment(scheduleRowId, amountPaid, paidAt, userId, notes) {
    const row = await get(scheduleRowId, repaymentsStore);
    if (!row) throw new Error('Schedule row not found: ' + scheduleRowId);
    
    // Save payment record
    const paymentRecord = {
      id: generateId(),
      scheduleId: scheduleRowId,
      loanId: row.loanId,
      clientId: row.clientId,
      amountPaid: amountPaid,
      amountDue: row.amount_due || row.amountDue,
      weekNumber: row.week || row.weekNumber,
      paidAt: paidAt || new Date().toISOString(),
      receivedBy: userId,
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };
    await set(paymentRecord.id, paymentRecord, paymentsStore);

    // Update the schedule row
    const updatedRow = {
      ...row,
      status: 'paid',
      amount_paid: (row.amount_paid || 0) + amountPaid,
      amountPaid: (row.amountPaid || 0) + amountPaid,
      paid_at: paymentRecord.paidAt,
      paidAt: paymentRecord.paidAt,
      received_by: userId,
      receivedBy: userId,
      paymentId: paymentRecord.id,
      paymentNotes: notes || '',
      updatedAt: new Date().toISOString(),
    };
    await set(scheduleRowId, updatedRow, repaymentsStore);
    
    return { scheduleRow: updatedRow, payment: paymentRecord };
  },

  async updatePayment(paymentId, amountPaid, paidAt, userId, notes) {
    const existingPayment = await get(paymentId, paymentsStore);
    if (!existingPayment) throw new Error('Payment record not found: ' + paymentId);

    const scheduleRowId = existingPayment.scheduleId;
    const row = await get(scheduleRowId, repaymentsStore);
    if (!row) throw new Error('Schedule row not found: ' + scheduleRowId);

    // Update payment record
    const updatedPayment = {
      ...existingPayment,
      amountPaid: amountPaid,
      paidAt: paidAt || new Date().toISOString(),
      receivedBy: userId,
      notes: notes || '',
      updatedAt: new Date().toISOString(),
    };
    await set(paymentId, updatedPayment, paymentsStore);

    // Update the schedule row
    const updatedRow = {
      ...row,
      status: 'paid',
      amount_paid: amountPaid, // Based on 1:1 assumption
      amountPaid: amountPaid,
      paid_at: updatedPayment.paidAt,
      paidAt: updatedPayment.paidAt,
      received_by: userId,
      receivedBy: userId,
      paymentNotes: notes || '',
      updatedAt: new Date().toISOString(),
    };
    await set(scheduleRowId, updatedRow, repaymentsStore);

    return { scheduleRow: updatedRow, payment: updatedPayment };
  },

  async getPaymentHistory(loanId) {
    const all = await values(paymentsStore);
    return all.filter(p => p.loanId === loanId).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
  },

  // REPORTS DATA
  async getPaymentReport(filters = {}) {
    let all = await values(paymentsStore);
    if (filters.dateFrom) all = all.filter(p => p.paid_at >= filters.dateFrom);
    if (filters.dateTo) all = all.filter(p => p.paid_at <= filters.dateTo);
    if (filters.officerId) all = all.filter(p => p.received_by === filters.officerId);
    
    const results = [];
    for (const p of all) {
        const loan = await this.getLoan(p.loanId);
        results.push({ ...p, loan });
    }
    return results;
  },

  async getArrearsReport(filters = {}) {
    const today = new Date().toISOString();
    let allRepayments = await values(repaymentsStore);
    let overdue = allRepayments.filter(r => r.status !== 'paid' && r.due_date < today);
    
    const results = [];
    for (const r of overdue) {
        const loan = await this.getLoan(r.loanId);
        if (filters.officerId && loan.applied_by !== filters.officerId) continue;
        results.push({ ...r, loan });
    }
    return results;
  },

  async getDisbursementReport(filters = {}) {
    let loans = await this.getLoans({ status: 'disbursed' });
    if (filters.dateFrom) loans = loans.filter(l => l.disbursed_at >= filters.dateFrom);
    if (filters.dateTo) loans = loans.filter(l => l.disbursed_at <= filters.dateTo);
    if (filters.officerId) loans = loans.filter(l => l.applied_by === filters.officerId);
    return loans;
  },

  async getRegistrationReport(filters = {}) {
    return await this.getClients(filters);
  },

  async getInterestReport(filters = {}) {
    const payments = await this.getPaymentReport(filters);
    // Interest is rough calculation for now
    return payments;
  },

  async getWeeklyCollections(userId = null) {
      const allPayments = await values(paymentsStore);
      const now = new Date();
      const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
      const monday = new Date(now);
      monday.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
      monday.setHours(0,0,0,0);

      const weekly = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      
      const filtered = allPayments.filter(p => {
          const date = new Date(p.paid_at);
          return date >= monday && (!userId || p.received_by === userId);
      });

      filtered.forEach(p => {
          const date = new Date(p.paid_at);
          let dayIndex = date.getDay() - 1; // Mon = 0
          if (dayIndex === -1) dayIndex = 6; // Sun = 6
          weekly[dayIndex] += (p.amountPaid || p.amount_paid || 0);
      });

      return weekly;
  },

  // NOTIFICATIONS
  async addNotification(recipientId, message, loanId = null, type = 'info') {
      const id = generateId();
      const n = {
          id,
          recipientId,
          message,
          loanId,
          type,
          read: false,
          createdAt: new Date().toISOString()
      };
      await set(id, n, notificationsStore);
      return n;
  },

  async getNotifications(userId) {
      const all = await values(notificationsStore);
      return all.filter(n => n.recipientId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async markNotificationRead(id) {
      await update(id, (val) => ({ ...val, read: true }), notificationsStore);
  },

  async getUnreadCount(userId) {
      const all = await this.getNotifications(userId);
      return all.filter(n => !n.read).length;
  },

  // DATA PORTABILITY
  async exportAll() {
    const data = {
      users: await values(usersStore),
      clients: await values(clientsStore),
      loans: await values(loansStore),
      collaterals: await values(collateralsStore),
      guarantors: await values(guarantorsStore),
      repayments: await values(repaymentsStore),
      payments: await values(paymentsStore),
      settings: await this.getSettings(),
      notifications: await values(notificationsStore)
    };
    return JSON.stringify(data, null, 2);
  },

  async importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      const stores = {
        users: usersStore,
        clients: clientsStore,
        loans: loansStore,
        collaterals: collateralsStore,
        guarantors: guarantorsStore,
        repayments: repaymentsStore,
        payments: paymentsStore,
        notifications: notificationsStore
      };

      for (const [key, store] of Object.entries(stores)) {
        if (data[key] && Array.isArray(data[key])) {
          for (const item of data[key]) {
            await set(item.id, item, store);
          }
        }
      }

      if (data.settings) {
        for (const [k, v] of Object.entries(data.settings)) {
          await set(k, v, settingsStore);
        }
      }
      return true;
    } catch (err) {
      console.error('Import failed:', err);
      throw new Error('Invalid backup file', { cause: err });
    }
  },

  async migrateClientStatuses() {
    const migrationKey = 'daricap_migration_client_status_v1';
    const done = localStorage.getItem(migrationKey);
    if (done) return;
    
    try {
      const allKeys = await keys(clientsStore);
      
      for (const k of allKeys) {
        const client = await get(k, clientsStore);
        if (!client) continue;
        
        const feePaid = client.registrationFeePaid === true 
                     || client.registration_fee_paid === true
                     || client.fee_status === 'paid';
        
        // Only update if there's a mismatch or missing normalized status
        if (feePaid && (client.registrationStatus !== 'complete' || !client.registration_status)) {
          const fixed = {
            ...client,
            registrationFeePaid:   true,
            registration_fee_paid: true,
            fee_status: 'paid',
            registrationStatus:    'complete',
            registration_status:   'complete',
          };
          await set(k, fixed, clientsStore);
          console.log('Migrated client status:', client.firstName || client.first_name, client.surname);
        }
      }
      
      localStorage.setItem(migrationKey, 'done');
      console.log('Client status migration complete.');
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }
};

export default db;
