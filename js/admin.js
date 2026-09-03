const loginGate = document.getElementById('loginGate');
const dashboard = document.getElementById('dashboard');
const authArea = document.getElementById('authArea');
const loginBtn = document.getElementById('loginBtn');
const dashError = document.getElementById('dashError');

const POCHE_LABELS = { A: 'Zakat / Solidarité', B: 'Soudure / Résilience', C: 'Capital productif', D: 'Contribution volontaire' };
const STATUS_LABELS = { completed: 'Confirmé', paid: 'Confirmé', pending: 'En attente', failed: 'Échoué', cancelled: 'Annulé' };

function fmt(n) {
  return Math.round(n || 0).toLocaleString('fr-FR');
}

loginBtn.addEventListener('click', () => netlifyIdentity.open('login'));

netlifyIdentity.on('init', (user) => {
  if (user) showDashboard(user);
});
netlifyIdentity.on('login', (user) => {
  netlifyIdentity.close();
  showDashboard(user);
});
netlifyIdentity.on('logout', () => {
  loginGate.style.display = 'block';
  dashboard.style.display = 'none';
  authArea.innerHTML = '';
});

function showDashboard(user) {
  loginGate.style.display = 'none';
  dashboard.style.display = 'block';
  authArea.innerHTML = `<span style="font-size:0.88rem; color:var(--ink-soft)">${user.email}</span>`;
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Se déconnecter';
  logoutBtn.className = 'btn-ghost';
  logoutBtn.style.padding = '8px 16px';
  logoutBtn.style.fontSize = '0.85rem';
  logoutBtn.addEventListener('click', () => netlifyIdentity.logout());
  authArea.appendChild(logoutBtn);

  loadDonations();
}

let donsChart = null;

async function loadDonations() {
  try {
    const user = netlifyIdentity.currentUser();
    const token = await user.jwt();
    const res = await fetch('/api/admin-donations', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      dashError.textContent = data.message || "Impossible de charger les dons.";
      return;
    }

    renderStats(data.donations);
    renderTable(data.donations);
    renderChart(data.donations);
    window.__donations = data.donations; // pour l'export CSV
  } catch (err) {
    dashError.textContent = "Erreur de connexion au tableau de bord.";
  }
}

function renderStats(donations) {
  const confirmed = donations.filter(d => d.status === 'completed' || d.status === 'paid');
  const pending = donations.filter(d => d.status === 'pending');
  const total = confirmed.reduce((sum, d) => sum + (Number(d.amountConfirmed || d.amount) || 0), 0);

  document.getElementById('statTotal').textContent = fmt(total) + ' FCFA';
  document.getElementById('statCount').textContent = confirmed.length;
  document.getElementById('statAvg').textContent = confirmed.length ? fmt(total / confirmed.length) + ' FCFA' : '—';
  document.getElementById('statPending').textContent = pending.length;
}

function renderTable(donations) {
  const tbody = document.getElementById('donationsTableBody');
  tbody.innerHTML = donations.map(d => `
    <tr style="border-bottom:1px solid var(--color-divider)">
      <td style="padding:12px 16px">${new Date(d.createdAt).toLocaleDateString('fr-FR')}</td>
      <td style="padding:12px 16px">${escapeHtml(d.nom || '')}</td>
      <td style="padding:12px 16px">${escapeHtml(d.tel || '')}</td>
      <td style="padding:12px 16px">${fmt(d.amountConfirmed || d.amount)} FCFA</td>
      <td style="padding:12px 16px">${POCHE_LABELS[d.poche] || d.poche || ''}</td>
      <td style="padding:12px 16px">${escapeHtml(d.method || '')}</td>
      <td style="padding:12px 16px">${d.frequence === 'mensuel' ? 'Mensuel' : 'Unique'}</td>
      <td style="padding:12px 16px">${STATUS_LABELS[d.status] || d.status}</td>
    </tr>
  `).join('') || '<tr><td style="padding:16px" colspan="8">Aucun don pour le moment.</td></tr>';
}

function renderChart(donations) {
  const confirmed = donations.filter(d => d.status === 'completed' || d.status === 'paid');
  const byDay = {};
  confirmed.forEach(d => {
    const day = new Date(d.updatedAt || d.createdAt).toLocaleDateString('fr-FR');
    byDay[day] = (byDay[day] || 0) + (Number(d.amountConfirmed || d.amount) || 0);
  });
  const labels = Object.keys(byDay);
  const values = Object.values(byDay);

  const ctx = document.getElementById('donsChart').getContext('2d');
  if (donsChart) donsChart.destroy();
  donsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Dons confirmés (FCFA)',
        data: values,
        borderColor: '#157f57',
        backgroundColor: 'rgba(21,127,87,0.12)',
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  const donations = window.__donations || [];
  const headers = ['Date', 'Nom', 'Téléphone', 'Email', 'Montant', 'Compartiment', 'Moyen', 'Fréquence', 'Statut', 'Référence'];
  const rows = donations.map(d => [
    new Date(d.createdAt).toLocaleDateString('fr-FR'),
    d.nom || '',
    d.tel || '',
    d.email || '',
    d.amountConfirmed || d.amount || 0,
    POCHE_LABELS[d.poche] || d.poche || '',
    d.method || '',
    d.frequence === 'mensuel' ? 'Mensuel' : 'Unique',
    STATUS_LABELS[d.status] || d.status,
    d.refCommand || '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `dons-mahdi-zakat-house-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
