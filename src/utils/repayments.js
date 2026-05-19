import pb from '../pocketbase';

/**
 * Generates the repayment schedule for a disbursed loan.
 * @param {Object} loan The loan application record
 */
export async function generateRepaymentSchedule(loan) {
  const disbursementDate = new Date(loan.disbursed_at);
  const weeks = parseInt(loan.repayment_weeks);
  const weeklyInstallment = parseFloat(loan.weekly_installment);

  const batch = [];

  for (let i = 1; i <= weeks; i++) {
    // Week 1 due date = disbursed_at + (i * 7 - 1) days? 
    // Instruction says: Week 1 = +6 days, Week 2 = +13 days.
    // So (i * 7 - 1)
    const dueDate = new Date(disbursementDate);
    dueDate.setDate(disbursementDate.getDate() + (i * 7 - 1));
    
    const scheduleItem = {
      loan_application: loan.id,
      week_number: i,
      due_date: dueDate.toISOString(),
      amount_due: weeklyInstallment,
      status: 'upcoming'
    };

    batch.push(pb.collection('repayment_schedule').create(scheduleItem));
  }

  await Promise.all(batch);
}

/**
 * Calculates current status based on date
 */
export function getRepaymentStatus(item) {
  if (item.status === 'paid') return 'paid';
  
  const now = new Date();
  const dueDate = new Date(item.due_date);
  const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 7) return 'missed';
  if (diffDays >= 1) return 'overdue';
  
  // Instruction says: "due: today is within the week window (days 1-6)"
  // "overdue: today is day 7 or beyond"
  // Let's refine based on user requirement:
  // "Week 1 due date = disbursed_at + 6 days (payment must be received by day 6, before day 7)"
  
  // If today is past due_date but less than 7 days past
  if (now > dueDate) {
     if (diffDays >= 7) return 'missed';
     return 'overdue';
  }
  
  // If we are within 6 days of the due date (upcoming or due)
  const windowStart = new Date(dueDate);
  windowStart.setDate(dueDate.getDate() - 6);
  
  if (now >= windowStart && now <= dueDate) return 'due';
  
  return 'upcoming';
}
