/* Kyenjojo TWSS — view layer. Vanilla JS, no build step. */
(function () {
  const DB = window.DB;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };

  const state = {
    screen: 'dash',
    sel: 0,
    filter: 'All',
    run: 0,
    field: 'route',
    entry: '019',
    picked: { 0: true, 1: true, 3: true }
  };

  /* ---------- shared bits ---------- */
  const CARD = 'bg-white border border-line rounded-[11px]';
  const HEAD = 'text-[13.5px] font-semibold';
  const SUB = 'text-[11.5px] text-muted';
  const LABEL = 'text-[11px] uppercase tracking-[.06em] text-muted font-semibold';
  const BTN = 'bg-brand-600 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg cursor-pointer hover:bg-[#0A5453]';
  const BTN2 = 'bg-[#F1F5F4] border border-line text-[#26413F] text-[12.5px] font-medium px-4 py-2.5 rounded-lg cursor-pointer hover:bg-[#E7EDEC]';
  const tonePill = { active: 'pill-active', arrears: 'pill-arrears', cut: 'pill-cut', new: 'pill-new', flat: 'pill-flat' };
  const toneChip = {
    ok: 'text-ok-fg bg-ok-bg', warn: 'text-warn-fg bg-warn-bg',
    bad: 'text-bad-fg bg-bad-bg', info: 'text-info-fg bg-info-bg', flat: 'text-muted-deep bg-[#F1F5F4]'
  };
  const dot = (c) => `<span class="w-2 h-2 rounded-full flex-none inline-block" style="background:${c}"></span>`;

  /* ---------- navigation ---------- */
  function renderNav() {
    $('#nav').innerHTML = DB.nav.map(([group, items]) => `
      <div class="text-[#4F7C7A] text-[9.5px] font-semibold tracking-[.11em] uppercase px-2 pt-3 pb-1.5">${group}</div>
      ${items.map(([id, label, icon, badge]) => {
        const on = state.screen === id;
        return `<button data-go="${id}" class="w-full text-left flex items-center gap-[9px] px-[9px] py-2 rounded-lg text-[12.8px] transition-colors ${
          on ? 'bg-brand-500 text-white font-medium' : 'text-[#9DBCBA] hover:bg-brand-800 hover:text-[#DCEDEC]'}">
          <span class="w-4 text-xs opacity-80">${icon}</span>${label}
          ${badge ? `<span class="ml-auto font-mono text-[10.5px] px-1.5 rounded-full ${on ? 'bg-white/20 text-white' : 'bg-brand-800 text-[#7FA9A7]'}">${badge}</span>` : ''}
        </button>`;
      }).join('')}
    `).join('');
  }

  /* ---------- screens ---------- */
  const screens = {};

  screens.dash = () => `
    <div class="grid grid-cols-4 gap-3.5">
      ${DB.kpis.map(k => `
        <div class="${CARD} px-4 py-[15px]">
          <div class="text-[11px] text-[#7A8B89] font-medium">${k.label}</div>
          <div class="font-mono text-[26px] font-semibold tracking-[-.02em] mt-[7px]">${k.value}</div>
          <div class="flex items-center gap-1.5 mt-2">
            <span class="text-[11px] font-semibold px-[7px] py-0.5 rounded-full ${toneChip[k.tone]}">${k.delta}</span>
            <span class="text-[11px] text-muted">${k.note}</span>
          </div>
        </div>`).join('')}
    </div>

    <div class="grid grid-cols-[1.55fr_1fr] gap-3.5 mt-3.5">
      <div class="${CARD} px-[18px] pt-4 pb-3">
        <div class="flex items-baseline gap-3">
          <div class="${HEAD}">Water balance by month</div>
          <div class="${SUB}">Produced vs billed volume, m³ · non-revenue water gap shaded</div>
        </div>
        <div class="flex items-end gap-3.5 mt-5">
          ${DB.months.map(([m, prod, bill, nrw]) => `
            <div class="flex-1 flex flex-col items-center gap-[7px]">
              <div class="w-full h-[150px] flex items-end justify-center gap-[3px]">
                <div class="w-[44%] rounded-t-[3px] bg-brand-200" style="height:${prod}%"></div>
                <div class="w-[44%] rounded-t-[3px] bg-brand-500" style="height:${bill}%"></div>
              </div>
              <div class="text-[10.5px] text-muted font-mono">${m}</div>
              <div class="text-[10px] text-[#B4740E] font-mono">${nrw}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="${CARD} px-[18px] py-4">
        <div class="${HEAD}">Zone status</div>
        <div class="${SUB} mt-0.5">Live pressure &amp; supply window</div>
        <div class="flex flex-col gap-[9px] mt-3.5">
          ${DB.zones.map(([name, win, bar, conns, c]) => `
            <div class="flex items-center gap-[11px] px-[11px] py-[9px] border border-[#E7ECEB] rounded-[9px]">
              ${dot(c)}
              <div class="min-w-0 flex-1">
                <div class="text-[12.5px] font-medium">${name}</div>
                <div class="text-[11px] text-muted">${win}</div>
              </div>
              <div class="text-right">
                <div class="font-mono text-[12.5px] font-semibold nowrap">${bar}</div>
                <div class="text-[10.5px] text-muted nowrap">${conns}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3.5 mt-3.5">
      <div class="${CARD} overflow-hidden">
        <div class="px-[18px] py-3.5 border-b border-line-soft flex items-center">
          <div class="${HEAD}">Needs your attention</div>
          <div class="ml-auto text-[11.5px] text-brand-600 font-medium">Work queue</div>
        </div>
        ${DB.queue.map(([tag, text, count, go, tone]) => `
          <button data-go="${go}" class="w-full text-left flex gap-3 items-center px-[18px] py-3 border-b border-line-faint hover:bg-[#F7FAF9]">
            <span class="text-[10.5px] font-semibold px-2 py-[3px] rounded-full w-[78px] text-center ${toneChip[tone]}">${tag}</span>
            <span class="text-[12.5px] flex-1">${text}</span>
            <span class="font-mono text-xs text-muted-deep">${count}</span>
            <span class="text-[#B6C2C0] text-[13px]">→</span>
          </button>`).join('')}
      </div>

      <div class="${CARD} px-[18px] py-4">
        <div class="flex items-center">
          <div class="${HEAD}">Collections this cycle</div>
          <div class="ml-auto font-mono text-xs text-muted-deep">UGX</div>
        </div>
        <div class="flex items-baseline gap-2.5 mt-3">
          <div class="font-mono text-[30px] font-semibold tracking-[-.02em]">34.2M</div>
          <div class="text-xs text-muted">of UGX 45.1M billed</div>
        </div>
        <div class="h-[9px] rounded-[5px] bg-line-soft mt-3.5 overflow-hidden flex">
          <div class="bg-brand-500" style="width:58%"></div>
          <div class="bg-[#E4B75C]" style="width:18%"></div>
        </div>
        <div class="flex gap-[18px] mt-3">
          ${DB.payMix.map(([l, v]) => `
            <div>
              <div class="text-[11px] text-muted">${l}</div>
              <div class="font-mono text-sm font-semibold mt-[3px]">${v}</div>
            </div>`).join('')}
        </div>
        <div class="mt-4 pt-3.5 border-t border-line-soft flex gap-2.5">
          <button data-go="billing" class="${BTN} flex-1">Run billing</button>
          <button data-go="arrears" class="${BTN2} flex-1">Arrears list</button>
        </div>
      </div>
    </div>`;

  screens.consumers = () => {
    const c = DB.consumers[state.sel] || DB.consumers[0];
    const facts = [
      ['Meter', c[3]], ['Connected', 'Mar 2019'], ['Avg use', '11 m³/mo'],
      ['Balance', c[4] === '0' ? 'Nil' : c[4]], ['Last paid', '02 Aug'], ['Household', '6 people']
    ];
    return `
    <div class="flex flex-wrap gap-3.5 items-stretch">
      <div class="${CARD} flex-1 basis-[620px] min-w-[620px] overflow-hidden">
        <div class="px-4 py-3 border-b border-line-soft flex gap-2 items-center">
          ${['All', 'Metered', 'Flat rate', 'In arrears', 'Disconnected'].map(f => `
            <button data-filter="${f}" class="text-xs px-3 py-1.5 rounded-[7px] ${
              state.filter === f ? 'bg-brand-700 text-white font-medium' : 'bg-[#F1F5F4] border border-line text-muted-deep hover:bg-[#E7EDEC]'}">${f}</button>`).join('')}
          <div class="ml-auto text-[11.5px] text-muted font-mono">3,412 accounts · 9 shown</div>
        </div>
        <div class="row-head cols-consumers">
          <div>Account</div><div>Consumer</div><div>Zone</div><div>Meter</div>
          <div class="text-right">Balance</div><div class="text-right">Status</div>
        </div>
        ${DB.consumers.map((r, i) => `
          <div data-sel="${i}" class="row cols-consumers row-click ${i === state.sel ? 'row-sel' : ''}">
            <div class="font-mono text-xs text-brand-600">${r[0]}</div>
            <div class="text-[12.5px] pr-2 truncate">${r[1]}</div>
            <div class="text-xs text-muted-deep">${r[2]}</div>
            <div class="font-mono text-[11.5px] text-muted-deep">${r[3]}</div>
            <div class="font-mono text-xs text-right ${r[4] === '0' ? 'text-[#9AA9A7]' : (r[5] === 'active' ? '' : 'text-bad-fg font-semibold')}">${r[4] === '0' ? '—' : r[4]}</div>
            <div class="text-right"><span class="pill ${tonePill[r[5]]}">${r[6]}</span></div>
          </div>`).join('')}
      </div>

      <div class="${CARD} flex-1 basis-[320px] min-w-[300px] max-w-[360px] p-[18px] self-start">
        <div class="font-mono text-[11.5px] text-brand-600">${c[0]}</div>
        <div class="text-[17px] font-semibold mt-1 tracking-[-.01em]">${c[1]}</div>
        <div class="text-xs text-muted mt-[3px]">Plot 14, Rwenjura Road · ${c[2]} Zone</div>
        <div class="flex gap-[7px] mt-3">
          <span class="pill ${tonePill[c[5]]}">${c[6]}</span>
          <span class="bg-[#F1F5F4] border border-line text-muted-deep text-[11px] px-2 py-[3px] rounded-full">${c[3] === '—' ? 'Unmetered flat rate' : 'Domestic slab tariff'}</span>
        </div>
        <div class="grid grid-cols-2 gap-2.5 mt-4">
          ${facts.map(([k, v]) => `
            <div class="bg-[#F7FAF9] border border-line-soft rounded-lg px-2.5 py-[9px]">
              <div class="text-[10.5px] text-muted">${k}</div>
              <div class="font-mono text-[13px] font-semibold mt-[3px]">${v}</div>
            </div>`).join('')}
        </div>
        <div class="${LABEL} mt-[18px]">Consumption, m³</div>
        <div class="flex items-end gap-[5px] mt-2.5">
          ${DB.consumerUsage.map(h => `
            <div class="flex-1 bar-track bar-track-sm">
              <div class="w-full bg-brand-500 rounded-t-[2px]" style="height:${h}%"></div>
            </div>`).join('')}
        </div>
        <div class="${LABEL} mt-[18px]">Recent activity</div>
        <div class="mt-1.5">
          ${DB.consumerActivity.map(([d, t, a]) => `
            <div class="flex gap-2.5 py-[9px] border-b border-line-faint">
              <div class="font-mono text-[11px] text-muted w-[52px] flex-none">${d}</div>
              <div class="text-xs flex-1">${t}</div>
              <div class="font-mono text-[11.5px]">${a}</div>
            </div>`).join('')}
        </div>
        <div class="flex gap-2 mt-4">
          <button class="${BTN} flex-1">Record payment</button>
          <button class="${BTN2} flex-none">Bill PDF</button>
        </div>
      </div>
    </div>`;
  };

  const flagMap = {
    ok: ['Clean', 'ok'], high: ['Spike', 'warn'], zero: ['Zero', 'info'],
    err: ['Error', 'bad'], miss: ['Missed', 'flat']
  };

  screens.readings = () => `
    <div class="grid grid-cols-4 gap-3.5">
      ${DB.readingKpis.map(([l, v, n]) => `
        <div class="${CARD} px-4 py-[15px]">
          <div class="text-[11px] text-[#7A8B89] font-medium">${l}</div>
          <div class="font-mono text-2xl font-semibold mt-1.5">${v}</div>
          <div class="text-[11px] text-muted mt-[5px]">${n}</div>
        </div>`).join('')}
    </div>
    <div class="mt-3.5 overflow-x-auto">
      <div class="${CARD} overflow-hidden min-w-[940px]">
        <div class="px-4 py-[13px] border-b border-line-soft flex items-center gap-2.5">
          <div class="${HEAD} whitespace-nowrap">Reading batch · Cycle 2026-09</div>
          <div class="${SUB}">Synced from field app · 4 exceptions need review before billing</div>
          <div class="ml-auto flex gap-2">
            <button class="${BTN2} whitespace-nowrap">Export CSV</button>
            <button data-go="billing" class="${BTN} whitespace-nowrap">Approve &amp; send to billing</button>
          </div>
        </div>
        <div class="row-head cols-readings">
          <div>Account</div><div>Consumer</div><div>Zone</div>
          <div class="text-right">Prev</div><div class="text-right">Current</div><div class="text-right">Usage m³</div>
          <div class="pl-4">Flag</div>
        </div>
        ${DB.readings.map(r => `
          <div class="row cols-readings ${r[6] === 'ok' ? '' : 'bg-[#FDFBF6]'}">
            <div class="font-mono text-xs text-brand-600">${r[0]}</div>
            <div class="text-[12.5px]">${r[1]}</div>
            <div class="text-xs text-muted-deep">${r[2]}</div>
            <div class="font-mono text-xs text-right text-muted-deep">${r[3]}</div>
            <div class="font-mono text-xs text-right">${r[4]}</div>
            <div class="font-mono text-xs text-right font-semibold">${r[5]}</div>
            <div class="pl-4 flex items-center gap-2">
              <span class="text-[10.5px] font-semibold px-2 py-[3px] rounded-full ${toneChip[flagMap[r[6]][1]]}">${flagMap[r[6]][0]}</span>
              <span class="text-[11.5px] text-muted whitespace-nowrap">${r[7]}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  screens.billing = () => {
    const runLabel = ['Generate 3,140 bills', 'Dispatch SMS & print', 'Run complete ✓'][state.run];
    return `
    <div class="grid grid-cols-[1fr_400px] gap-3.5">
      <div class="flex flex-col gap-3.5">
        <div class="${CARD} p-[18px]">
          <div class="flex items-center">
            <div>
              <div class="text-sm font-semibold">Billing run · September 2026</div>
              <div class="text-xs text-muted mt-[3px]">Meter-read consumers on slab tariff, flat-rate for unmetered &amp; kiosks</div>
            </div>
            <button id="run-btn" class="ml-auto nowrap text-[12.5px] font-medium px-4 py-[9px] rounded-lg cursor-pointer ${
              state.run > 1 ? 'bg-ok-bg text-ok-fg' : 'bg-brand-600 text-white hover:bg-[#0A5453]'}">${runLabel}</button>
          </div>
          <div class="flex mt-5 items-start">
            ${DB.billingSteps.map(([title, sub, at], i, arr) => {
              const done = state.run >= at && at !== 99 && (at === 0 || state.run >= at);
              const isDone = at === 0 || state.run >= at;
              const isNow = !isDone && (at === state.run + 1);
              return `
              <div class="flex-1 flex flex-col gap-[9px]">
                <div class="flex items-center">
                  <div class="w-6 h-6 flex-none rounded-full grid place-items-center text-[11px] font-semibold ${
                    isDone ? 'bg-brand-600 text-white' : isNow ? 'bg-white text-brand-600 border-2 border-brand-600' : 'bg-line-soft text-[#9AA9A7]'}">${isDone ? '✓' : i + 1}</div>
                  ${i === arr.length - 1 ? '' : `<div class="flex-1 h-0.5 ${isDone ? 'bg-brand-600' : 'bg-line'}"></div>`}
                </div>
                <div class="pr-3.5">
                  <div class="text-[12.5px] font-medium">${title}</div>
                  <div class="text-[11.5px] text-muted mt-0.5">${sub}${isDone ? ' ✓' : ''}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="${CARD} p-[18px]">
          <div class="${HEAD}">Tariff schedule</div>
          <div class="${SUB} mt-[3px]">Effective 01 Jul 2026 · approved by the Water Authority Board</div>
          <div class="cols-tariff grid pt-2.5 pb-2 border-b border-line-soft mt-3.5 text-[10.5px] uppercase tracking-[.06em] text-muted font-semibold">
            <div>Category</div><div>Band</div><div class="text-right">UGX / m³</div><div class="text-right">Monthly fixed</div>
          </div>
          ${DB.tariffs.map(t => `
            <div class="cols-tariff grid py-2.5 border-b border-line-faint">
              <div class="text-[12.5px]">${t[0]}</div>
              <div class="font-mono text-xs text-muted-deep">${t[1]}</div>
              <div class="font-mono text-[12.5px] text-right font-semibold">${t[2]}</div>
              <div class="font-mono text-xs text-right text-muted-deep">${t[3]}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="${CARD} px-6 py-[22px] self-start">
        <div class="flex items-start">
          <div>
            <div class="text-[11px] uppercase tracking-[.1em] text-muted font-semibold">Water bill</div>
            <div class="text-[15px] font-semibold mt-1">Kyenjojo TWSS</div>
          </div>
          <div class="ml-auto text-right font-mono text-[11.5px] text-muted">
            <div>INV-26090-0148</div><div>Due 20 Sep 2026</div>
          </div>
        </div>
        <div class="border-t border-line-soft mt-4 pt-3.5 text-[12.5px] leading-relaxed">
          <div class="font-semibold">Nakato Sarah Kabahenda</div>
          <div class="text-muted">Plot 14, Rwenjura Road, Central Zone<br />Acct KW-0148 · Meter M-31402</div>
        </div>
        <div class="mt-4 border-t border-line-soft">
          ${DB.billLines.map(([l, q, a]) => `
            <div class="flex gap-3 py-[9px] border-b border-line-faint">
              <div class="text-[12.5px] flex-1">${l}</div>
              <div class="font-mono text-[11.5px] text-muted">${q}</div>
              <div class="font-mono text-[12.5px] w-[82px] text-right">${a}</div>
            </div>`).join('')}
        </div>
        <div class="flex items-baseline mt-3.5">
          <div class="text-[13px] font-semibold">Total due</div>
          <div class="ml-auto font-mono text-[22px] font-semibold nowrap">UGX 48,600</div>
        </div>
        <div class="bg-brand-50 border border-brand-200 rounded-[9px] px-[13px] py-3 mt-4">
          <div class="text-[11px] uppercase tracking-[.06em] text-brand-600 font-semibold">Pay by mobile money</div>
          <div class="font-mono text-[12.5px] mt-1.5 leading-loose">MTN *165# · Airtel *185#<br />Merchant 274500 · Ref KW-0148</div>
        </div>
        <div class="text-[11px] text-[#9AA9A7] mt-3.5 leading-normal">Disconnection notice issued 7 days after due date. Reconnection fee UGX 20,000.</div>
      </div>
    </div>`;
  };

  screens.arrears = () => {
    const n = Object.keys(state.picked).filter(k => state.picked[k]).length;
    return `
    <div class="grid grid-cols-4 gap-3.5">
      ${DB.arrearKpis.map(([l, v, note, red]) => `
        <div class="${CARD} px-4 py-[15px]">
          <div class="text-[11px] text-[#7A8B89] font-medium">${l}</div>
          <div class="font-mono text-2xl font-semibold mt-1.5 ${red ? 'text-bad-fg' : ''}">${v}</div>
          <div class="text-[11px] text-muted mt-[5px]">${note}</div>
        </div>`).join('')}
    </div>
    <div class="mt-3.5 overflow-x-auto">
      <div class="${CARD} overflow-hidden min-w-[900px]">
        <div class="px-4 py-[13px] border-b border-line-soft flex items-center gap-2.5">
          <div class="${HEAD} whitespace-nowrap">Disconnection worklist</div>
          <div class="${SUB}">Sorted by age of oldest unpaid bill</div>
          <div class="ml-auto flex gap-2">
            <button class="${BTN2} whitespace-nowrap">Send SMS reminder</button>
            <button class="bg-bad-fg text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg cursor-pointer hover:bg-[#8E2C22] whitespace-nowrap">Issue notices (${n})</button>
          </div>
        </div>
        <div class="row-head cols-arrears">
          <div></div><div>Account</div><div>Consumer</div><div>Zone</div>
          <div class="text-right">Owed</div><div class="text-right">Age</div><div class="pl-4">Next action</div>
        </div>
        ${DB.arrears.map((a, i) => {
          const on = !!state.picked[i];
          return `
          <div data-pick="${i}" class="row cols-arrears row-click ${on ? 'bg-brand-50' : ''}">
            <div class="w-4 h-4 rounded grid place-items-center text-[10px] text-white ${on ? 'bg-brand-600 border border-brand-600' : 'bg-white border border-[#CBD5D3]'}">${on ? '✓' : ''}</div>
            <div class="font-mono text-xs text-brand-600">${a[0]}</div>
            <div class="text-[12.5px]">${a[1]}</div>
            <div class="text-xs text-muted-deep">${a[2]}</div>
            <div class="font-mono text-xs text-right font-semibold text-bad-fg">${a[3]}</div>
            <div class="font-mono text-xs text-right text-muted-deep">${a[4]}</div>
            <div class="pl-4"><span class="pill ${tonePill[a[6]]}">${a[5]}</span></div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  };

  const typePill = {
    'No water': 'pill-cut', Leak: 'pill-new', Billing: 'pill-arrears',
    Meter: 'pill-flat', Quality: 'pill-purple', Connection: 'pill-active'
  };

  screens.complaints = () => `
    <div class="grid grid-cols-4 gap-3.5 items-start">
      ${DB.boards.map(([title, color, cards]) => `
        <div class="bg-[#EAEFEE] border border-line rounded-[11px] p-3">
          <div class="flex items-center gap-2 px-1 pb-2.5">
            ${dot(color)}
            <div class="text-[12.5px] font-semibold">${title}</div>
            <div class="ml-auto font-mono text-[11.5px] text-[#7A8B89]">${cards.length}</div>
          </div>
          <div class="flex flex-col gap-[9px]">
            ${cards.map(c => `
              <div class="bg-white border border-[#E4EAE9] rounded-[9px] px-3 py-[11px] cursor-pointer hover:border-brand-300">
                <div class="flex items-center gap-[7px]">
                  <span class="pill ${typePill[c[0]] || 'pill-flat'}">${c[0]}</span>
                  <span class="font-mono text-[10.5px] text-[#9AA9A7] ml-auto">${c[1]}</span>
                </div>
                <div class="text-[12.5px] leading-snug mt-2">${c[2]}</div>
                <div class="flex items-center gap-[7px] mt-2.5 pt-[9px] border-t border-line-faint">
                  <div class="w-5 h-5 rounded-full bg-brand-200 text-[#2C5F5D] text-[9.5px] font-semibold grid place-items-center">${c[4]}</div>
                  <div class="text-[11px] text-muted">${c[3]}</div>
                  <div class="ml-auto text-[11px] text-muted font-mono">${c[5]}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;

  const cellClass = { f: 'bg-brand-500 text-white', p: 'bg-brand-300 text-[#0B3B39]', x: 'bg-line-soft text-[#A8B5B3]' };

  screens.ops = () => `
    <div class="grid grid-cols-[1fr_340px] gap-3.5">
      <div class="${CARD} p-[18px]">
        <div class="flex items-baseline gap-3">
          <div class="${HEAD}">Supply schedule · week of 31 Aug</div>
          <div class="${SUB}">Rationed pumping from Mabira borehole &amp; Nyabwina intake</div>
        </div>
        <div class="cols-week grid mt-4 text-[10.5px] text-muted font-semibold tracking-[.06em] uppercase">
          <div></div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
        </div>
        ${DB.schedule.map(row => `
          <div class="cols-week grid items-center py-[9px] border-b border-line-faint gap-1">
            <div class="text-[12.5px] font-medium">${row[0]}</div>
            ${row.slice(1).map(([kind, label]) => `
              <div class="text-center text-[10.5px] font-mono px-0.5 py-[7px] rounded-md ${cellClass[kind]}">${label}</div>`).join('')}
          </div>`).join('')}
        <div class="flex gap-4 mt-3.5 text-[11px] text-muted items-center">
          <div class="flex gap-1.5 items-center"><span class="w-[11px] h-[11px] rounded-[3px] bg-brand-500"></span>Full supply</div>
          <div class="flex gap-1.5 items-center"><span class="w-[11px] h-[11px] rounded-[3px] bg-brand-300"></span>Partial / low pressure</div>
          <div class="flex gap-1.5 items-center"><span class="w-[11px] h-[11px] rounded-[3px] bg-line-soft border border-line"></span>Closed</div>
        </div>
      </div>

      <div class="flex flex-col gap-3.5">
        <div class="${CARD} px-[18px] py-4">
          <div class="${HEAD}">Reservoir levels</div>
          <div class="flex flex-col gap-3 mt-3.5">
            ${DB.tanks.map(([name, pct, color, note]) => `
              <div>
                <div class="flex text-xs"><div>${name}</div><div class="ml-auto font-mono font-semibold">${pct}%</div></div>
                <div class="h-2 rounded bg-line-soft mt-1.5 overflow-hidden">
                  <div class="h-full" style="width:${pct}%;background:${color}"></div>
                </div>
                <div class="text-[11px] text-muted mt-[5px]">${note}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="${CARD} px-[18px] py-4">
          <div class="${HEAD}">Water quality log</div>
          ${DB.quality.map(([point, time, cl, turb, c]) => `
            <div class="flex items-center gap-2.5 py-2.5 border-b border-line-faint">
              ${dot(c)}
              <div class="flex-1">
                <div class="text-[12.5px]">${point}</div>
                <div class="text-[11px] text-muted">${time}</div>
              </div>
              <div class="text-right font-mono text-xs">
                <div>${cl}</div><div class="text-[10.5px] text-muted">${turb}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  const routeState = {
    next: ['Read now', 'bg-brand-600 text-white', '#0E6E6B'],
    pending: ['', 'bg-transparent', '#CBD5D3'],
    locked: ['Gate locked', 'bg-warn-bg text-warn-fg', '#E4B75C'],
    done: ['✓', 'bg-ok-bg text-ok-fg', '#2F6B3F']
  };

  screens.field = () => {
    const titles = { route: ['Route CZ-03', '28 / 46 done', '☰'], capture: ['Capture reading', 'Stop 29', '←'], done: ['Saved', '', '←'] };
    const [ftitle, fmeta, fback] = titles[state.field];
    const n = parseFloat(state.entry);
    const usage = isNaN(n) || n < 1842 ? '—' : String(Math.round(n - 1842));

    const body = {
      route: `
        <div class="bg-white rounded-xl p-3.5 border border-[#E4EAE9]">
          <div class="flex items-baseline">
            <div class="text-[12.5px] font-semibold nowrap">Route CZ-03 · Central</div>
            <div class="ml-auto font-mono text-xs text-brand-600 nowrap">28 / 46</div>
          </div>
          <div class="h-[7px] rounded bg-line-soft mt-[9px] overflow-hidden"><div class="h-full bg-brand-500" style="width:61%"></div></div>
        </div>
        <div class="flex flex-col gap-[9px] mt-3">
          ${DB.route.map(([name, meta, st]) => `
            <button data-field="capture" class="w-full text-left bg-white border border-[#E4EAE9] rounded-xl px-3.5 py-[13px] flex gap-3 items-center hover:border-brand-300">
              ${dot(routeState[st][2])}
              <div class="flex-1 min-w-0">
                <div class="text-[13.5px] font-medium">${name}</div>
                <div class="font-mono text-[11.5px] text-muted mt-[3px]">${meta}</div>
              </div>
              <span class="text-[10.5px] font-semibold px-[9px] py-1 rounded-full ${routeState[st][1]}">${routeState[st][0]}</span>
            </button>`).join('')}
        </div>`,
      capture: `
        <div class="bg-white border border-[#E4EAE9] rounded-xl p-[15px]">
          <div class="text-sm font-semibold">Byaruhanga Moses</div>
          <div class="text-xs text-muted mt-[3px]">KW-0212 · Meter M-31688 · Plot 7, Kabarole Rd</div>
          <div class="flex gap-2.5 mt-3.5">
            <div class="flex-1 bg-[#F7FAF9] border border-line-soft rounded-[9px] p-2.5">
              <div class="text-[10.5px] text-muted">Previous</div>
              <div class="font-mono text-[17px] font-semibold mt-[3px]">01842</div>
            </div>
            <div class="flex-1 bg-brand-50 border border-brand-200 rounded-[9px] p-2.5">
              <div class="text-[10.5px] text-brand-600">Usage m³</div>
              <div class="font-mono text-[17px] font-semibold mt-[3px] text-brand-600">${usage}</div>
            </div>
          </div>
          <div class="${LABEL} mt-4">Current reading</div>
          <div class="font-mono text-[34px] font-semibold tracking-[.06em] text-center pt-3.5 pb-1.5 border-b-2 border-brand-500">${state.entry || '—'}</div>
          <div class="grid grid-cols-3 gap-2 mt-3.5">
            ${['1','2','3','4','5','6','7','8','9','⌫','0','.'].map(k => `
              <button data-key="${k}" class="text-center font-mono text-[19px] font-medium py-3 rounded-[9px] bg-[#F1F5F4] border border-line hover:bg-[#E7EDEC] select-none">${k}</button>`).join('')}
          </div>
          <div class="flex gap-2 mt-3.5">
            <button class="${BTN2} flex-none">◎</button>
            <button class="${BTN2} flex-none">⚑</button>
            <button data-field="done" class="flex-1 bg-brand-600 text-white text-sm font-semibold py-[13px] rounded-[9px] hover:bg-[#0A5453]">Save &amp; next</button>
          </div>
        </div>`,
      done: `
        <div class="bg-white border border-[#E4EAE9] rounded-xl p-[22px] text-center">
          <div class="w-[54px] h-[54px] mx-auto rounded-full bg-brand-100 text-brand-600 text-2xl grid place-items-center">✓</div>
          <div class="text-[15px] font-semibold mt-3.5">Reading saved offline</div>
          <div class="text-[12.5px] text-muted mt-1.5 leading-normal">13 readings queued. They will upload automatically at the next network window.</div>
          <button data-field="route" class="w-full bg-brand-600 text-white text-[13.5px] font-semibold py-3 rounded-[9px] mt-[18px] hover:bg-[#0A5453]">Next meter →</button>
        </div>
        <div class="bg-white border border-[#E4EAE9] rounded-xl p-3.5 mt-3">
          <div class="text-xs font-semibold">Today</div>
          <div class="flex gap-2.5 mt-[11px]">
            ${[['28','Read'],['3','Flagged'],['13','Queued']].map(([v, k]) => `
              <div class="flex-1 bg-[#F7FAF9] border border-line-soft rounded-[9px] p-2.5 text-center">
                <div class="font-mono text-[17px] font-semibold">${v}</div>
                <div class="text-[10.5px] text-muted mt-[3px]">${k}</div>
              </div>`).join('')}
          </div>
        </div>`
    }[state.field];

    const steps = [['Download route', '46 meters, offline map tiles', 'route'], ['Capture reading', 'Keypad, photo proof, exception flags', 'capture'], ['Sync queue', 'Uploads when signal returns', 'done']];

    return `
    <div class="flex gap-6 items-start justify-center pt-1.5 flex-wrap">
      <div class="w-[330px] flex-none">
        <div class="text-[15px] font-semibold">Meter reader app</div>
        <div class="text-[12.5px] text-[#7A8B89] mt-1.5 leading-relaxed">Offline-first Android app for field staff. Routes download at the depot, readings queue locally and sync when a signal returns.</div>
        <div class="flex flex-col gap-2 mt-[18px]">
          ${steps.map(([t, s, id], i) => `
            <button data-field="${id}" class="w-full text-left flex gap-[11px] items-start bg-white border rounded-[10px] px-[13px] py-3 hover:border-brand-300 ${state.field === id ? 'border-brand-600' : 'border-[#E4EAE9]'}">
              <span class="w-5 h-5 flex-none rounded-full text-[11px] font-semibold grid place-items-center ${state.field === id ? 'bg-brand-600 text-white' : 'bg-line-soft text-[#7A8B89]'}">${i + 1}</span>
              <span>
                <span class="block text-[12.5px] font-medium">${t}</span>
                <span class="block text-[11.5px] text-muted mt-0.5">${s}</span>
              </span>
            </button>`).join('')}
        </div>
      </div>

      <div class="phone w-[352px] flex-none bg-brand-900 rounded-[36px] p-[11px]">
        <div class="bg-[#F4F6F5] rounded-[27px] overflow-hidden h-[700px] flex flex-col">
          <div class="bg-brand-600 text-white px-[18px] pt-3 flex-none">
            <div class="flex font-mono text-[11px] opacity-85"><div>09:14</div><div class="ml-auto">◍ offline · 12 queued</div></div>
            <div class="flex items-center gap-2.5 pt-3 pb-3.5">
              <button data-field="route" class="text-[17px] w-[18px] text-left">${fback}</button>
              <div class="text-[15px] font-semibold whitespace-nowrap">${ftitle}</div>
              <div class="ml-auto text-[11.5px] opacity-85">${fmeta}</div>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-3.5">${body}</div>
        </div>
      </div>

      <div class="${CARD} w-[300px] flex-none px-[18px] py-4">
        <div class="text-[13px] font-semibold">Field sync status</div>
        ${DB.syncRows.map(([name, route, done, c]) => `
          <div class="flex items-center gap-2.5 py-[11px] border-b border-line-faint">
            ${dot(c)}
            <div class="flex-1">
              <div class="text-[12.5px]">${name}</div>
              <div class="text-[11px] text-muted">${route}</div>
            </div>
            <div class="font-mono text-xs text-muted-deep">${done}</div>
          </div>`).join('')}
      </div>
    </div>`;
  };

  screens.portal = () => `
    <div class="max-w-[920px] mx-auto">
      <div class="bg-brand-900 rounded-[14px] px-[26px] py-6 text-white flex items-start flex-wrap gap-4">
        <div>
          <div class="text-[11.5px] text-[#7FA9A7] uppercase tracking-[.06em] font-semibold">Account KW-0148</div>
          <div class="text-[22px] font-semibold mt-2 tracking-[-.01em]">Nakato Sarah Kabahenda</div>
          <div class="text-[12.5px] text-[#9BC0BE] mt-[5px]">Plot 14, Rwenjura Road · Central Zone · Domestic metered</div>
        </div>
        <div class="ml-auto text-right">
          <div class="text-[11.5px] text-[#7FA9A7]">Balance due</div>
          <div class="font-mono text-[30px] font-semibold mt-1 nowrap">UGX 48,600</div>
          <button class="bg-brand-500 text-[13px] font-semibold px-[18px] py-2.5 rounded-[9px] mt-3 hover:bg-[#159A95] whitespace-nowrap">Pay with mobile money</button>
        </div>
      </div>

      <div class="grid grid-cols-[1.3fr_1fr] gap-3.5 mt-3.5">
        <div class="${CARD} p-[18px]">
          <div class="flex items-baseline gap-2.5">
            <div class="${HEAD}">Your usage</div>
            <div class="${SUB}">m³ per month · you use 12% less than similar homes</div>
          </div>
          <div class="flex items-end gap-[9px] mt-[18px]">
            ${DB.portalUsage.map(([m, v, h], i) => `
              <div class="flex-1 flex flex-col items-center gap-[7px]">
                <div class="font-mono text-[10.5px] text-muted">${v}</div>
                <div class="w-full bar-track bar-track-lg">
                  <div class="w-full rounded-t-[3px] ${i === DB.portalUsage.length - 1 ? 'bg-brand-500' : 'bg-brand-200'}" style="height:${h}%"></div>
                </div>
                <div class="text-[10.5px] text-muted">${m}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="${CARD} p-[18px]">
          <div class="${HEAD}">Supply in Central Zone</div>
          <div class="flex gap-2.5 items-center bg-brand-50 border border-brand-200 rounded-[9px] p-3 mt-3">
            ${dot('#2F8F6E')}<div class="text-[12.5px]">Water on now · until 11:00</div>
          </div>
          <div class="${LABEL} mt-[18px]">Next windows</div>
          ${DB.portalWindows.map(([d, t]) => `
            <div class="flex py-2.5 border-b border-line-faint text-[12.5px]">
              <div class="nowrap">${d}</div><div class="ml-auto font-mono text-muted-deep nowrap">${t}</div>
            </div>`).join('')}
          <button class="${BTN2} w-full mt-4">Report a problem</button>
        </div>
      </div>

      <div class="${CARD} mt-3.5 overflow-hidden">
        <div class="px-[18px] py-3.5 border-b border-line-soft ${HEAD}">Bills &amp; receipts</div>
        ${DB.portalBills.map(b => `
          <div class="row cols-bills">
            <div class="font-mono text-xs text-brand-600">${b[0]}</div>
            <div class="text-[12.5px]">${b[1]}</div>
            <div class="font-mono text-xs text-muted-deep">${b[2]}</div>
            <div class="font-mono text-[12.5px] font-semibold">${b[3]}</div>
            <div class="text-right"><span class="pill ${tonePill[b[4]]}">${b[5]}</span></div>
          </div>`).join('')}
      </div>
    </div>`;

  /* ---------- render + events ---------- */
  function render() {
    const [title, sub] = DB.pages[state.screen];
    $('#page-title').textContent = title;
    $('#page-sub').textContent = sub;
    $('#view').innerHTML = screens[state.screen]();
    $('#view').scrollTop = 0;
    renderNav();
    location.hash = state.screen;
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { state.screen = go.dataset.go; return render(); }

    const sel = e.target.closest('[data-sel]');
    if (sel) { state.sel = +sel.dataset.sel; return render(); }

    const filter = e.target.closest('[data-filter]');
    if (filter) { state.filter = filter.dataset.filter; return render(); }

    const pick = e.target.closest('[data-pick]');
    if (pick) { const i = pick.dataset.pick; state.picked[i] = !state.picked[i]; return render(); }

    const field = e.target.closest('[data-field]');
    if (field) {
      state.field = field.dataset.field;
      if (state.field === 'route') state.entry = '019';
      return render();
    }

    const key = e.target.closest('[data-key]');
    if (key) {
      const k = key.dataset.key;
      state.entry = k === '⌫' ? state.entry.slice(0, -1) : (state.entry.length >= 6 ? state.entry : state.entry + k);
      return render();
    }

    if (e.target.closest('#run-btn')) { state.run = Math.min(2, state.run + 1); return render(); }
  });

  const hash = location.hash.slice(1);
  if (DB.pages[hash]) state.screen = hash;
  render();
})();
