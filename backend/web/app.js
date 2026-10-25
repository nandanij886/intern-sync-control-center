// VIMS front end: polls /api/state every second and draws the OS internals live.
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const COLORS = ['#58e6a9','#6cb6ff','#ffb454','#c792ea','#ff7b9c','#7fdbca','#f2d57e','#82aaff'];
const color = pid => COLORS[(pid - 1) % COLORS.length];
const viewed = {}, comments = {};
let lastState = null, lastSel = null, me = localStorage.getItem('vims_name') || '', selected = null, saveTimer = null;

// ---------- tabs
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab,.view').forEach(e => e.classList.remove('active'));
  b.classList.add('active'); $(b.dataset.tab).classList.add('active');
});

// ---------- api helpers
async function post(url, data) {
  const r = await fetch(url, {method: 'POST', body: new URLSearchParams(data || {})});
  return {ok: r.ok, text: await r.text()};
}
function toast(t) { $('toast').textContent = t; setTimeout(() => $('toast').textContent = '', 4000); }

// ---------- dashboard buttons
$('btnDemo').onclick = async () => toast((await post('/api/demo')).text);
$('btnBackup').onclick = async () => toast((await post('/api/backup')).text);
$('algo').onchange = e => post('/api/algorithm', {name: e.target.value});
$('policy').onchange = e => post('/api/policy', {name: e.target.value});

// ---------- intern tab
$('iName').value = me;
$('btnCreate').onclick = async () => {
  const name = $('iName').value.trim();
  if (!name) { $('iMsg').textContent = 'Please enter your name.'; return; }
  me = name; localStorage.setItem('vims_name', me);
  const r = await post('/api/sessions', {intern: name, task: $('iTask').value || 'General task',
    burst: $('iBurst').value, priority: $('iPrio').value, deadline: $('iDead').value});
  $('iMsg').textContent = r.ok ? 'Session created (pid ' + JSON.parse(r.text).pid + '). Waiting for admission.' : r.text;
  if (r.ok) selected = JSON.parse(r.text).pid;
};
$('draft').oninput = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const r = await post('/api/draft', {pid: selected, user: me, text: $('draft').value});
    $('draftMsg').textContent = r.ok ? 'Draft sent (autosave thread writes it to disk every 3 ticks).' : 'Cannot edit: ' + r.text;
  }, 400);
};

// ---------- mentor tab
async function viewSubmission(pid) {
  const r = await fetch('/api/submission?pid=' + pid + '&role=mentor');
  viewed[pid] = await r.text();
  $('sub' + pid).textContent = viewed[pid];
}
async function approve(pid) {
  const r = await post('/api/feedback', {pid, role: 'mentor', comment: $('cm' + pid).value});
  toast(r.text);
}
function pick(pid) { selected = pid; renderNow(); }
window.viewSubmission = viewSubmission; window.approve = approve; window.pick = pick;
window.comments = comments;

// ---------- rendering
function render(d) {
  const s = d.scheduler, byPid = {};
  s.sessions.forEach(x => byPid[x.pid] = x);
  $('tick').textContent = s.tick; $('quantum').textContent = s.quantum;

  // CPU + ready queue + gantt
  const run = byPid[s.running];
  $('cpu').innerHTML = run ? 'PID ' + run.pid + ' · ' + esc(run.intern) + ' <small style="color:var(--muted)">' + run.remaining + ' left</small>' : 'idle';
  $('ready').innerHTML = s.ready.map(p => '<span class="chip" style="border-color:' + color(+p) + '">P' + p + '</span>').join('') || '<span class="note">empty</span>';
  $('gantt').innerHTML = s.gantt.map(p => '<i style="background:' + (p ? color(p) : '#222b3a') + '">' + (p || '') + '</i>').join('');
  $('sCompleted').textContent = s.completed; $('sWait').textContent = s.avgWait; $('sTA').textContent = s.avgTurnaround;

  // algorithm comparison
  $('algo').value = s.algo;
  $('cmp').querySelector('tbody').innerHTML = d.compare.map(c => '<tr><td>' + esc(c.name) + '</td><td>' + c.avgWait + '</td><td>' + c.avgTurnaround + '</td></tr>').join('') || '<tr><td colspan="3" class="note">Create sessions to see the comparison.</td></tr>';

  // resources
  $('res').innerHTML = d.resources.items.map(r => {
    const used = r.total - r.available;
    return '<div class="rrow"><span>' + r.name + '</span><span>' + used + ' / ' + r.total + '</span></div><div class="bar"><i style="width:' + (used / r.total * 100) + '%"></i></div>';
  }).join('');
  $('resNote').textContent = 'State: ' + (d.resources.safe ? 'SAFE' : 'UNSAFE') + ' · granted ' + d.resources.granted + ' · refused ' + d.resources.refused;

  // sessions table
  $('sessions').querySelector('tbody').innerHTML = s.sessions.map(x => {
    const pct = Math.round((x.burst - x.remaining) / x.burst * 100);
    const plag = x.checked ? Math.round(x.similarity * 100) + '%' : (x.state === 'AWAITING_FEEDBACK' ? 'checking…' : '–');
    return '<tr><td style="color:' + color(x.pid) + '">P' + x.pid + (x.running ? ' ▶' : '') + '</td><td>' + esc(x.intern) + '</td>'
      + '<td><span class="badge ' + x.state + '">' + x.state.replace('_', ' ') + '</span>' + (x.urgent && x.state === 'WORKING' ? ' <span class="badge" style="color:var(--bad);border-color:var(--bad)">urgent</span>' : '') + (x.auto ? ' <span class="badge">auto</span>' : '') + '</td>'
      + '<td>' + x.priority + '</td><td><div class="bar"><i style="width:' + pct + '%"></i></div></td><td>' + x.wait + '</td><td>' + x.attendance + '</td><td>t' + x.deadline + '</td><td>' + plag + '</td></tr>';
  }).join('') || '<tr><td colspan="9" class="note">No sessions yet. Use “Load demo” or the Intern tab.</td></tr>';

  // memory
  $('policy').value = d.memory.policy;
  $('frames').innerHTML = d.memory.frames.map((f, i) => f.pid
    ? '<div class="frame used" style="border-color:' + color(f.pid) + '"><b>frame ' + i + '</b>P' + f.pid + '<br>' + f.page + '</div>'
    : '<div class="frame"><b>frame ' + i + '</b>free</div>').join('');
  $('memNote').textContent = 'hits ' + d.memory.hits + ' · page faults ' + d.memory.faults + ' · replacements ' + d.memory.replaced;

  // threads
  $('threads').innerHTML = d.workers.threads.map(t => '<div class="trow"><span>' + t.name + '</span><span>' + t.state + '</span></div>').join('');
  $('thNote').textContent = 'attendance ticks ' + d.workers.attendanceTicks + ' · autosaves ' + d.workers.autosaves + ' · plagiarism checks ' + d.workers.checks;
  $('queue').firstElementChild.style.width = (d.queue.size / d.queue.capacity * 100) + '%';

  // disk
  $('disk').innerHTML = '<div class="rrow"><span>FCFS head movement</span><span>' + d.disk.fcfs + '</span></div>'
    + '<div class="rrow"><span>SSTF head movement</span><span>' + d.disk.sstf + '</span></div>'
    + '<div class="note">Recent requests (cylinders): ' + (d.disk.requests.join(', ') || 'none') + '<br>Head starts at ' + d.disk.head + '. Smaller is better.</div>';

  // log
  const log = $('log'), bottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
  log.textContent = d.logs.join('\n'); if (bottom) log.scrollTop = log.scrollHeight;

  // intern tab
  const mine = s.sessions.filter(x => me && x.intern.toLowerCase() === me.toLowerCase());
  $('mine').innerHTML = mine.map(x => '<span class="chip click' + (x.pid === selected ? ' sel' : '') + '" onclick="pick(' + x.pid + ')">P' + x.pid + ' · ' + esc(x.task) + ' · ' + x.state.replace('_', ' ') + '</span>').join('') || '<span class="note">No sessions for this name yet.</span>';
  const cur = byPid[selected];
  $('editor').style.display = cur && mine.includes(cur) ? 'block' : 'none';
  if (selected !== lastSel) { $('draft').value = ''; $('draftMsg').textContent = ''; lastSel = selected; }
  if (cur) {
    $('editorTitle').textContent = 'P' + cur.pid + ' · ' + cur.task + ' · ' + cur.remaining + ' units left';
    $('draft').disabled = !(cur.state === 'WORKING' || cur.state === 'LOGIN');
    if (cur.feedback) $('draftMsg').textContent = 'Mentor feedback: ' + cur.feedback;
  }

  // mentor tab
  const pend = s.sessions.filter(x => x.state === 'AWAITING_FEEDBACK');
  if (!document.activeElement || document.activeElement.tagName !== 'INPUT')
    $('pending').innerHTML = pend.map(x => '<div class="pend"><b>P' + x.pid + ' · ' + esc(x.intern) + '</b> · ' + esc(x.task)
      + (x.auto ? ' · <span style="color:var(--warn)">auto-submitted at deadline</span>' : '')
      + '<div class="note">Plagiarism: ' + (x.checked ? Math.round(x.similarity * 100) + '% similar to earlier work' : 'check in progress (needs a review room first)') + '</div>'
      + '<pre id="sub' + x.pid + '">' + esc(viewed[x.pid] || '') + '</pre><input id="cm' + x.pid + '" placeholder="Feedback comment" value="' + esc(comments[x.pid] || '') + '" oninput="comments[' + x.pid + ']=this.value"> '
      + '<div style="margin-top:8px"><button class="ghost" onclick="viewSubmission(' + x.pid + ')">View submission</button> '
      + '<button ' + (x.checked ? '' : 'disabled') + ' onclick="approve(' + x.pid + ')">Give feedback &amp; submit</button></div></div>').join('')
      || '<span class="note">Nothing is waiting for feedback.</span>';
}
function renderNow() { if (lastState) render(lastState); }
window.renderNow = renderNow;

async function poll() {
  try { lastState = await (await fetch('/api/state')).json(); render(lastState); } catch (e) { /* server not reachable */ }
}
poll(); setInterval(poll, 1000);
