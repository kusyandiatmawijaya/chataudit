const getDateRange = (period) => {
  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
  const day = parseInt(parts.find(p => p.type === 'day').value);

  // Helper to create UTC date representing start and end of a specific WIB day
  const getWibDay = (offsetDays = 0) => {
    const start = new Date(Date.UTC(year, month, day + offsetDays, -7, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day + offsetDays, 16, 59, 59, 999));
    return { start, end };
  };

  let start, end;

  switch (period.toLowerCase()) {
    case 'today':
      ({ start } = getWibDay(0));
      end = new Date(); // Up to now
      break;
    case 'yesterday':
      ({ start, end } = getWibDay(-1));
      break;
    case 'last_2_days':
      ({ start } = getWibDay(-2));
      end = new Date();
      break;
    case 'last_7_days':
      ({ start } = getWibDay(-7));
      end = new Date();
      break;
    case 'last_30_days':
      ({ start } = getWibDay(-30));
      end = new Date();
      break;
    case 'last_month':
      // Start of last month
      start = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
      // End of last month
      end = new Date(Date.UTC(year, month, 0, 16, 59, 59, 999));
      break;
    default:
      ({ start } = getWibDay(0));
      end = new Date();
      break;
  }

  return { start, end };
};

console.log('Today:', getDateRange('today'));
console.log('Yesterday:', getDateRange('yesterday'));
console.log('Last 2 Days:', getDateRange('last_2_days'));
console.log('Last Month:', getDateRange('last_month'));
