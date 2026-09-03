function fmtStat(n) {
  return Math.round(n || 0).toLocaleString('fr-FR');
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();

    if (!data.donorCount) return; // garde l'état "collecte en cours" par défaut

    document.getElementById('impactEmpty').style.display = 'none';
    document.getElementById('impactContent').style.display = 'block';

    document.getElementById('statTotalCollecte').textContent = fmtStat(data.totalAmount) + ' FCFA';
    document.getElementById('statDonorCount').textContent =
      data.donorCount === 1 ? '1 don confirmé' : `${data.donorCount} dons confirmés`;

    document.getElementById('statPocheA').textContent = fmtStat(data.totalsByPoche.A) + ' FCFA';
    document.getElementById('statPocheB').textContent = fmtStat(data.totalsByPoche.B) + ' FCFA';
    document.getElementById('statPocheC').textContent = fmtStat(data.totalsByPoche.C) + ' FCFA';
    document.getElementById('statPocheD').textContent = fmtStat(data.totalsByPoche.D) + ' FCFA';
  } catch (e) {
    // Silencieux - garde l'état "collecte en cours" par défaut
  }
}

loadStats();
