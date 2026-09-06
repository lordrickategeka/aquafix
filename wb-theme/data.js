/* Kyenjojo TWSS — sample data (swap for API responses) */
window.DB = {
  pages: {
    dash:       ['Operations overview', 'Kyenjojo Town · 3,412 connections'],
    consumers:  ['Consumer registry', 'Accounts, meters and balances'],
    readings:   ['Meter readings', 'Cycle 2026-09 · 2,986 of 3,140 read'],
    billing:    ['Billing & tariffs', 'Generate, review and dispatch bills'],
    arrears:    ['Arrears & disconnection', 'UGX 18.4M outstanding across 214 accounts'],
    complaints: ['Complaints & service requests', '31 open · median resolution 2.4 days'],
    ops:        ['Supply scheduling & quality', 'Zones, reservoirs, chlorine residual'],
    field:      ['Meter reader app', 'Android · offline-first'],
    portal:     ['Customer portal', 'What consumers see on the web']
  },

  nav: [
    ['Office', [
      ['dash', 'Dashboard', '◨', ''],
      ['consumers', 'Consumers', '☰', '3,412'],
      ['readings', 'Readings', '◔', '4'],
      ['billing', 'Billing & tariffs', '₵', ''],
      ['arrears', 'Arrears', '⚠', '214']
    ]],
    ['Operations', [
      ['ops', 'Supply & quality', '≈', ''],
      ['complaints', 'Service requests', '✎', '31']
    ]],
    ['Other apps', [
      ['field', 'Meter reader app', '▤', ''],
      ['portal', 'Customer portal', '◉', '']
    ]]
  ],

  kpis: [
    { label: 'Water produced (Aug)', value: '41,280 m³', delta: '+3.1%', tone: 'ok', note: 'vs July' },
    { label: 'Non-revenue water', value: '28.4%', delta: '−2.2 pts', tone: 'warn', note: 'target 22%' },
    { label: 'Collection efficiency', value: '76%', delta: '+5 pts', tone: 'ok', note: 'cycle to date' },
    { label: 'Outstanding balance', value: '18.4M', delta: '214 accts', tone: 'bad', note: 'UGX' }
  ],

  months: [
    ['Feb', 72, 48, '31%'], ['Mar', 78, 54, '30%'], ['Apr', 85, 61, '28%'], ['May', 80, 56, '30%'],
    ['Jun', 88, 64, '27%'], ['Jul', 92, 66, '28%'], ['Aug', 96, 71, '26%'], ['Sep', 60, 44, '—']
  ],

  zones: [
    ['Central', '06:00–11:00 daily', '2.4 bar', '1,180 conns', '#2F8F6E'],
    ['Kihuura', '06:00–10:00 alt days', '1.1 bar', '642 conns', '#E4B75C'],
    ['Butunduzi', 'Mon/Wed/Fri', '0.6 bar', '388 conns', '#C4574A'],
    ['Nyantungo', '05:00–09:00 daily', '2.0 bar', '724 conns', '#2F8F6E'],
    ['Katooke', 'Tue–Sat mornings', '1.8 bar', '478 conns', '#2F8F6E']
  ],

  queue: [
    ['Readings', '4 reading exceptions block the billing run', '4', 'readings', 'warn'],
    ['Arrears', 'Accounts past 60 days awaiting disconnection notice', '18', 'arrears', 'bad'],
    ['Requests', 'Service requests unassigned for over 24 h', '6', 'complaints', 'info'],
    ['Ops', 'Butunduzi reservoir below 30% for 3 days', '—', 'ops', 'flat']
  ],

  payMix: [
    ['MTN MoMo', '19.8M'], ['Airtel Money', '8.1M'], ['Bank', '4.4M'], ['Cash desk', '1.9M']
  ],

  /* acct, name, zone, meter, balance, tone, status */
  consumers: [
    ['KW-0148', 'Nakato Sarah Kabahenda', 'Central', 'M-31402', '48,600', 'arrears', 'Overdue'],
    ['KW-0212', 'Byaruhanga Moses', 'Central', 'M-31688', '0', 'active', 'Active'],
    ['KW-0233', 'Kyenjojo Secondary School', 'Katooke', 'M-30117', '412,000', 'arrears', 'Overdue'],
    ['KW-0301', 'Tumusiime Grace', 'Kihuura', 'M-32240', '12,400', 'active', 'Active'],
    ['KW-0344', 'Rwenzori Grain Millers', 'Nyantungo', 'M-30988', '1,204,500', 'cut', 'Disconnected'],
    ['KW-0402', 'Asiimwe Robert', 'Butunduzi', '—', '9,000', 'flat', 'Flat rate'],
    ['KW-0455', 'Kihuura Health Centre III', 'Kihuura', 'M-31955', '0', 'active', 'Active'],
    ['KW-0489', 'Mugisha Denis', 'Central', 'M-32611', '24,800', 'arrears', 'Overdue'],
    ['KW-0510', 'Namara Joy Kiiza', 'Katooke', 'M-32780', '0', 'new', 'New']
  ],

  consumerUsage: [42, 55, 38, 61, 70, 52, 64, 58],
  consumerActivity: [
    ['02 Sep', 'Bill INV-26090-0148 issued', '48,600'],
    ['02 Aug', 'Mobile money payment · MTN', '-41,200'],
    ['28 Jul', 'Reading 01842 captured', '13 m³'],
    ['11 Jun', 'Complaint: low pressure · resolved', '—']
  ],

  readingKpis: [
    ['Meters read', '2,986', '95% of route'],
    ['Exceptions', '4', 'block the billing run'],
    ['Missed / no access', '154', 'estimate applied'],
    ['Avg per reader / day', '112', '3 readers active']
  ],

  /* acct, name, zone, prev, curr, usage, flag, note */
  readings: [
    ['KW-0148', 'Nakato Sarah K.', 'Central', '01829', '01842', '13', 'ok', 'Normal'],
    ['KW-0212', 'Byaruhanga Moses', 'Central', '01655', '01661', '6', 'ok', 'Normal'],
    ['KW-0233', 'Kyenjojo Sec. School', 'Katooke', '09420', '09902', '482', 'high', '8× average — verify'],
    ['KW-0301', 'Tumusiime Grace', 'Kihuura', '00744', '00744', '0', 'zero', 'No consumption 2 cycles'],
    ['KW-0455', 'Kihuura Health Centre', 'Kihuura', '04120', '04187', '67', 'ok', 'Normal'],
    ['KW-0489', 'Mugisha Denis', 'Central', '02201', '02198', '—', 'err', 'Reading below previous'],
    ['KW-0510', 'Namara Joy Kiiza', 'Katooke', '00088', '00099', '11', 'ok', 'Normal'],
    ['KW-0655', 'Nyantungo Trading C.', 'Nyantungo', '03310', '—', '—', 'miss', 'Meter buried — not read'],
    ['KW-0721', 'Tibenda Alex', 'Butunduzi', '01044', '01059', '15', 'ok', 'Normal']
  ],

  billingSteps: [
    ['Readings locked', '2,986 approved', 0],
    ['Tariff applied', 'Slab + fixed charge', 0],
    ['Bills generated', '3,140 documents', 1],
    ['SMS dispatch', '2,704 numbers on file', 2],
    ['Printed round', '436 hand-delivered', 3]
  ],

  tariffs: [
    ['Domestic metered', '0 – 5 m³', '1,050', '2,000'],
    ['Domestic metered', '6 – 20 m³', '2,180', '2,000'],
    ['Domestic metered', 'Above 20 m³', '3,400', '2,000'],
    ['Institutional', 'All volume', '2,650', '5,000'],
    ['Commercial / industrial', 'All volume', '4,120', '12,000'],
    ['Public standpipe / kiosk', 'Flat', '—', '9,000']
  ],

  billLines: [
    ['Water consumed 0–5 m³', '5 × 1,050', '5,250'],
    ['Water consumed 6–13 m³', '8 × 2,180', '17,440'],
    ['Monthly service charge', '1 × 2,000', '2,000'],
    ['Sewerage & sanitation levy', '10%', '2,469'],
    ['Brought forward (Aug)', 'unpaid', '21,441']
  ],

  arrearKpis: [
    ['Total outstanding', '18.4M', 'UGX across 214 accounts', true],
    ['Over 90 days', '6.1M', '23 accounts · 33% of debt', true],
    ['On payment plans', '37', 'UGX 2.8M scheduled', false],
    ['Reconnected this month', '12', 'UGX 240,000 in fees', false]
  ],

  arrears: [
    ['KW-0344', 'Rwenzori Grain Millers', 'Nyantungo', '1,204,500', '118 d', 'Disconnect', 'cut'],
    ['KW-0233', 'Kyenjojo Secondary School', 'Katooke', '412,000', '92 d', 'Payment plan', 'arrears'],
    ['KW-0067', 'Kabatoro Lodge', 'Central', '268,900', '74 d', 'Disconnect', 'cut'],
    ['KW-0489', 'Mugisha Denis', 'Central', '24,800', '61 d', 'Final notice', 'arrears'],
    ['KW-0148', 'Nakato Sarah Kabahenda', 'Central', '48,600', '47 d', 'SMS reminder', 'arrears'],
    ['KW-0721', 'Tibenda Alex', 'Butunduzi', '31,200', '44 d', 'SMS reminder', 'arrears'],
    ['KW-0655', 'Nyantungo Trading Centre', 'Nyantungo', '96,400', '38 d', 'Final notice', 'arrears'],
    ['KW-0812', 'Komuhangi Sylvia', 'Kihuura', '18,900', '33 d', 'SMS reminder', 'arrears']
  ],

  boards: [
    ['New', '#A6362B', [
      ['No water', 'SR-2291', 'Dry taps since Tuesday, whole lane affected', 'Kihuura', 'JM', '4 h'],
      ['Leak', 'SR-2294', 'Burst pipe near the market gate, water flowing to road', 'Central', '—', '1 h'],
      ['Billing', 'SR-2295', 'Bill shows 90 m³, household is two people', 'Katooke', '—', '40 m']
    ]],
    ['Triage', '#B4740E', [
      ['Meter', 'SR-2288', 'Meter glass broken, dial unreadable', 'Nyantungo', 'AK', '1 d'],
      ['Quality', 'SR-2287', 'Brown water after the pump restart', 'Butunduzi', 'AK', '1 d']
    ]],
    ['In the field', '#0E6E6B', [
      ['Leak', 'SR-2281', 'Service line leak at Plot 22 — parts ordered', 'Central', 'TM', '2 d'],
      ['No water', 'SR-2279', 'Low pressure at the upper end of Kihuura', 'Kihuura', 'TM', '3 d'],
      ['Connection', 'SR-2276', 'New connection survey requested', 'Katooke', 'JM', '3 d']
    ]],
    ['Resolved', '#8B9A98', [
      ['Billing', 'SR-2270', 'Reading corrected, bill re-issued', 'Central', 'SN', 'Closed'],
      ['Leak', 'SR-2264', 'Main repaired at Nyabwina junction', 'Nyantungo', 'TM', 'Closed']
    ]]
  ],

  schedule: [
    ['Central', ['f', '06–11'], ['f', '06–11'], ['f', '06–11'], ['f', '06–11'], ['f', '06–11'], ['f', '06–14'], ['p', '07–10']],
    ['Kihuura', ['f', '06–10'], ['p', '06–09'], ['f', '06–10'], ['p', '06–09'], ['f', '06–10'], ['f', '06–12'], ['x', '—']],
    ['Butunduzi', ['p', '07–09'], ['x', '—'], ['f', '06–10'], ['x', '—'], ['f', '06–10'], ['p', '07–10'], ['x', '—']],
    ['Nyantungo', ['f', '05–09'], ['f', '05–09'], ['p', '06–08'], ['f', '05–09'], ['f', '05–09'], ['f', '05–11'], ['p', '07–09']],
    ['Katooke', ['x', '—'], ['f', '06–10'], ['f', '06–10'], ['f', '06–10'], ['p', '06–08'], ['f', '06–12'], ['x', '—']]
  ],

  tanks: [
    ['Mabira main reservoir', 78, '#12807C', '390 m³ of 500 m³ · filling'],
    ['Kihuura tower', 46, '#E4B75C', '92 m³ of 200 m³ · drawing down'],
    ['Butunduzi tank', 27, '#C4574A', '27 m³ of 100 m³ · pump fault']
  ],

  quality: [
    ['Mabira outlet', 'Today 07:10', '0.7 mg/L', '0.4 NTU', '#2F8F6E'],
    ['Central Zone tap 4', 'Today 08:25', '0.4 mg/L', '0.9 NTU', '#2F8F6E'],
    ['Butunduzi tank', 'Today 08:50', '0.1 mg/L', '3.8 NTU', '#C4574A'],
    ['Nyantungo intake', 'Yesterday 16:40', '0.6 mg/L', '1.2 NTU', '#E4B75C']
  ],

  route: [
    ['Byaruhanga Moses', 'KW-0212 · M-31688', 'next'],
    ['Katusabe Ritah', 'KW-0214 · M-31690', 'pending'],
    ['Ssemwogerere John', 'KW-0219 · M-31702', 'pending'],
    ['Kobusingye Anne', 'KW-0221 · M-31711', 'locked'],
    ['Rwenjura Kiosk 2', 'KW-0225 · flat rate', 'pending'],
    ['Mugume Patrick', 'KW-0230 · M-31740', 'done']
  ],

  syncRows: [
    ['Tumwine Josephat', 'Route CZ-03 · Central', '28/46', '#E4B75C'],
    ['Akello Brenda', 'Route KH-01 · Kihuura', '46/46', '#2F8F6E'],
    ['Muhumuza Eric', 'Route NY-02 · Nyantungo', '31/38', '#E4B75C'],
    ['Nabbosa Irene', 'Route KT-01 · Katooke', '0/34', '#C4574A']
  ],

  portalUsage: [['Feb', 9, 42], ['Mar', 11, 52], ['Apr', 10, 47], ['May', 13, 61], ['Jun', 12, 56], ['Jul', 14, 66], ['Aug', 13, 61], ['Sep', 11, 52]],

  portalWindows: [['Tomorrow', '06:00 – 11:00'], ['Saturday', '06:00 – 14:00'], ['Sunday', '07:00 – 10:00 (low)']],

  portalBills: [
    ['INV-26090-0148', 'Sep 2026 · 13 m³', '13 m³', '48,600', 'arrears', 'Due 20 Sep'],
    ['INV-26080-0148', 'Aug 2026 · 13 m³', '13 m³', '41,200', 'active', 'Paid'],
    ['INV-26070-0148', 'Jul 2026 · 14 m³', '14 m³', '44,100', 'active', 'Paid'],
    ['INV-26060-0148', 'Jun 2026 · 12 m³', '12 m³', '38,900', 'active', 'Paid']
  ]
};
