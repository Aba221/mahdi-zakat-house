const amountGrid = document.getElementById('amountGrid');
const amountChips = amountGrid.querySelectorAll('.amount-chip');
const amountCustomBtn = document.getElementById('amountCustomBtn');
const amountInput = document.getElementById('amountInput');
const methodGrid = document.getElementById('methodGrid');
const methodChips = methodGrid.querySelectorAll('.method-chip');
const donForm = document.getElementById('donForm');
const donError = document.getElementById('donError');
const donSubmit = document.getElementById('donSubmit');

let selectedAmount = null;
let selectedMethod = null;
let selectedPoche = 'A';
let selectedFreq = 'unique';

const pocheChips = document.querySelectorAll('.poche-chip');
pocheChips.forEach(chip => {
  chip.addEventListener('click', () => {
    pocheChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedPoche = chip.dataset.poche;
  });
});

const freqChips = document.querySelectorAll('.freq-chip');
const freqNote = document.getElementById('freqNote');
freqChips.forEach(chip => {
  chip.addEventListener('click', () => {
    freqChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedFreq = chip.dataset.freq;
    freqNote.style.display = selectedFreq === 'mensuel' ? 'block' : 'none';
  });
});

function selectAmountChip(chip){
  amountChips.forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  if (chip.dataset.amount === 'custom') {
    amountInput.style.display = 'block';
    amountInput.focus();
    selectedAmount = parseFloat(amountInput.value) || null;
  } else {
    amountInput.style.display = 'none';
    selectedAmount = parseInt(chip.dataset.amount, 10);
  }
}

amountChips.forEach(chip => {
  chip.addEventListener('click', () => selectAmountChip(chip));
});

amountInput.addEventListener('input', () => {
  selectedAmount = parseFloat(amountInput.value) || null;
});

methodChips.forEach(chip => {
  chip.addEventListener('click', () => {
    methodChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedMethod = chip.dataset.method;
  });
});

// Called from calculette.js when the user clicks "Verser ce montant"
window.setDonationAmount = function(amount){
  amountCustomBtn.click();
  amountInput.value = amount;
  selectedAmount = amount;
};

function showError(msg){
  donError.textContent = msg;
  donError.classList.add('show');
}
function clearError(){
  donError.classList.remove('show');
  donError.textContent = '';
}

donForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const nom = document.getElementById('donNom').value.trim();
  const tel = document.getElementById('donTel').value.trim();
  const email = document.getElementById('donEmail').value.trim();

  if (!selectedAmount || selectedAmount < 500) {
    showError('Veuillez choisir ou saisir un montant valide (500 FCFA minimum).');
    return;
  }
  if (!selectedMethod) {
    showError('Veuillez choisir un moyen de paiement.');
    return;
  }
  if (!nom || !tel) {
    showError('Merci de renseigner votre nom et votre numéro de téléphone.');
    return;
  }

  donSubmit.disabled = true;
  donSubmit.textContent = 'Redirection en cours…';

  try {
    const res = await fetch('/api/initiate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedAmount,
        method: selectedMethod,
        poche: selectedPoche,
        frequence: selectedFreq,
        nom, tel, email
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Une erreur est survenue lors de l'initialisation du paiement.");
    }

    window.location.href = data.redirect_url;
  } catch (err) {
    showError(err.message || "Impossible de lancer le paiement pour le moment. Réessayez dans un instant.");
    donSubmit.disabled = false;
    donSubmit.textContent = 'Continuer le paiement';
  }
});
