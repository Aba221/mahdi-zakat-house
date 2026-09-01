const tickerList = document.getElementById('tickerList');

function timeAgo(iso){
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function firstNameOnly(nom){
  if (!nom) return 'Un donateur';
  return nom.trim().split(/\s+/)[0];
}

async function loadTicker(){
  try {
    const res = await fetch('/api/recent-donations');
    if (!res.ok) return;
    const data = await res.json();
    const donations = data.donations || [];
    if (!donations.length) return; // garde le message "Soyez le premier..."

    tickerList.innerHTML = donations.slice(0, 6).map(d => `
      <div class="ticker-item">
        <span><span class="who">${firstNameOnly(d.nom)}</span> a donné ${Number(d.amount).toLocaleString('fr-FR')} FCFA</span>
        <span>${timeAgo(d.updatedAt || d.createdAt)}</span>
      </div>
    `).join('');
  } catch (e) {
    // Silencieux - le ticker reste en état vide si l'API n'est pas encore configurée
  }
}

loadTicker();
