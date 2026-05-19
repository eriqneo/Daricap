
export function getGreeting(firstName) {
  const hour = new Date().getHours();
  let timeGreeting;
  if (hour >= 5 && hour < 12)       timeGreeting = 'Good morning';
  else if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) timeGreeting = 'Good evening';
  else                               timeGreeting = 'Good night';
  
  return `${timeGreeting}, ${firstName}`;
}

export function getMotivationalSub(role) {
  const adminMessages = [
    'Here is your overview for today.',
    'You have decisions waiting.',
    'Stay on top of your approvals.',
  ];
  const officerMessages = [
    'Ready to help your clients today?',
    'Your clients are counting on you.',
    'Let\'s make an impact today.',
  ];
  const messages = role === 'admin' ? adminMessages : officerMessages;
  return messages[new Date().getDate() % messages.length];
}
