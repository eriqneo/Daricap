import db from '../db';

const firstNames = [
  'Samuel', 'Jane', 'David', 'Mary', 'Joseph', 'Grace', 'Moses', 'Ruth', 'Peter', 'Esther',
  'Daniel', 'Sarah', 'Joshua', 'Alice', 'Andrew', 'Hellen', 'Francis', 'Lydia', 'James', 'Rose',
  'John', 'Beatrice', 'Simon', 'Teresa', 'Paul', 'Margaret', 'Philip', 'Gladys', 'Stephen', 'Catherine'
];

const surnames = [
  'Kipchoge', 'Wanjiku', 'Ochieng', 'Muthoni', 'Kariuki', 'Anyango', 'Kamau', 'Awuor', 'Njoroge', 'Achieng',
  'Mwangi', 'Otieno', 'Maina', 'Okoth', 'Kibet', 'Nekesa', 'Moraa', 'Mutua', 'Langat', 'Cheruiyot',
  'Odhiambo', 'Nduta', 'Githinji', 'Adhiambo', 'Waweru', 'Chepngetich', 'Ngugi', 'Kiptoo', 'Wambui', 'Omondi'
];

const residences = [
  'Nakuru Town', 'Lanet', 'Njoro', 'Molo', 'Gilgil', 'Naivasha', 'Bahati', 'Subukia', 'Rongai', 'Kuresoi'
];

function generateIdNumber() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generatePhoneNumber() {
  const prefix = ['07', '01'][Math.floor(Math.random() * 2)];
  const rest = Math.floor(10000000 + Math.random() * 90000000).toString();
  return prefix + rest;
}

export async function seedClients(count = 20) {
  const users = await db.getUsers();
  const officer = users.find(u => u.role === 'loan_officer') || users[0];
  
  if (!officer) {
    throw new Error('No system user found to attribute clients to.');
  }

  const clients = [];
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const middleName = firstNames[Math.floor(Math.random() * firstNames.length)];
    
    const client = {
      title: Math.random() > 0.5 ? 'Mr' : 'Mrs',
      first_name: firstName,
      middle_name: middleName,
      surname: surname,
      gender: Math.random() > 0.5 ? 'male' : 'female',
      national_id: generateIdNumber(),
      kra_pin: 'A' + Math.floor(100000000 + Math.random() * 900000000) + 'Z',
      residence: residences[Math.floor(Math.random() * residences.length)],
      mobile: generatePhoneNumber(),
      alt_mobile: '',
      fee_status: Math.random() > 0.5 ? 'paid' : 'unpaid',
      created_by: officer.id,
      created_by_name: officer.name,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString()
    };
    
    const saved = await db.saveClient(client);
    clients.push(saved);
  }
  
  return clients;
}
