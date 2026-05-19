
export function formatLoanStatus(status) {
  const map = {
    'pending':            'Pending Review',
    'approved':           'Approved',
    'partially_approved': 'Partially Approved',
    'declined':           'Declined',
    'disbursed':          'Disbursed',
    'closed':             'Fully Repaid',
  };
  return map[status] || (status || 'Unknown');
}

export function getLoanStatusBadge(status) {
  const map = {
    'pending':            'badge-warning',
    'approved':           'badge-success',
    'partially_approved': 'badge-info',
    'declined':           'badge-danger',
    'disbursed':          'badge-gray',
    'closed':             'badge-success',
  };
  return map[status] || 'badge-gray';
}

export function displayLoanProduct(loan) {
  if (!loan) return '<span style="color:#A0AEBF;font-style:italic">Not specified</span>';
  
  const product = loan.loanProduct 
               || loan.loan_product 
               || loan.product 
               || null;
  
  if (!product || product === 'undefined' || product === 'null') {
    return '<span style="color:#A0AEBF;font-style:italic">Not specified</span>';
  }
  
  // Color-code the two products
  const isOkoa = product.toLowerCase().includes('okoa');
  const color = isOkoa ? '#1558A8' : '#0F6E56';
  const bg    = isOkoa ? '#EBF4FF' : '#E1F5EE';
  
  return `<span style="
    background: ${bg}; 
    color: ${color}; 
    padding: 3px 10px; 
    border-radius: 20px; 
    font-size: 12px; 
    font-weight: 600;
  ">${product}</span>`;
}

export function getLoanProductName(loan) {
  if (!loan) return 'Not specified';
  const product = loan.loanProduct || loan.loan_product || loan.product;
  if (!product || product === 'undefined' || product === 'null') return 'Not specified';
  return product;
}
