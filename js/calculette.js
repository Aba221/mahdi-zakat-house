const revenuInput = document.getElementById('revenuInput');
const periodeSelect = document.getElementById('periodeSelect');
const calcOutput = document.getElementById('calcOutput');
const calcToDon = document.getElementById('calcToDon');

function formatFCFA(n){
  return Math.round(n).toLocaleString('fr-FR');
}

function computeZakat(){
  const revenu = parseFloat(revenuInput.value) || 0;
  const annuel = periodeSelect.value === 'annuel' ? revenu : revenu * 12;
  const zakat = annuel / 40; // 1/40, sur base annuelle
  calcOutput.textContent = formatFCFA(zakat);
  calcToDon.dataset.suggestedAmount = Math.max(500, Math.round(zakat));
}

revenuInput.addEventListener('input', computeZakat);
periodeSelect.addEventListener('change', computeZakat);
computeZakat();

calcToDon.addEventListener('click', (e) => {
  const suggested = calcToDon.dataset.suggestedAmount;
  if (suggested && window.setDonationAmount) {
    e.preventDefault();
    window.setDonationAmount(parseInt(suggested, 10));
    document.getElementById('don').scrollIntoView({ behavior: 'smooth' });
  }
});
