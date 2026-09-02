const revenuInput = document.getElementById('revenuInput');
const calcOutput = document.getElementById('calcOutput');
const calcToDon = document.getElementById('calcToDon');

function formatFCFA(n){
  return Math.round(n).toLocaleString('fr-FR');
}

function computeZakat(){
  const revenu = parseFloat(revenuInput.value) || 0;
  // "La zakat sur toutes les sources de revenus, à chaud" : 1/40 s'applique
  // directement sur le montant renseigné, quelle que soit sa périodicité.
  const zakat = revenu / 40;
  calcOutput.textContent = formatFCFA(zakat);
  calcToDon.dataset.suggestedAmount = Math.max(500, Math.round(zakat));
}

revenuInput.addEventListener('input', computeZakat);
computeZakat();

calcToDon.addEventListener('click', (e) => {
  const suggested = calcToDon.dataset.suggestedAmount;
  if (suggested && window.setDonationAmount) {
    e.preventDefault();
    window.setDonationAmount(parseInt(suggested, 10));
    document.getElementById('don').scrollIntoView({ behavior: 'smooth' });
  }
});