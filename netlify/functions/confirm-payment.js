// netlify/functions/confirm-payment.js
// Appelée par merci.html quand le donateur revient de PayDunya.
// Reprend le principe de confirmCheckout() (BRVM Analyst Pro) : le
// paramètre d'URL "ref" ne sert qu'à retrouver la transaction, jamais à
// décider du statut — on revérifie toujours réellement auprès de PayDunya.

const { getStore } = require('@netlify/blobs');
const { verifyInvoice } = require('./lib/paydunya');

exports.handler = async (event) => {
  const refCommand = event.queryStringParameters && event.queryStringParameters.ref;
  if (!refCommand) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Référence manquante.' }) };
  }

  const store = getStore('donations');
  const donation = await store.get(refCommand, { type: 'json' });

  if (!donation) {
    return { statusCode: 404, body: JSON.stringify({ success: false, message: 'Don introuvable.' }) };
  }

  // Déjà confirmé (ex: webhook arrivé avant le retour du donateur) : pas
  // besoin de rappeler PayDunya.
  if (donation.status === 'completed' || donation.status === 'paid') {
    return { statusCode: 200, body: JSON.stringify({ success: true, status: 'completed', amount: donation.amount }) };
  }

  if (!donation.providerReference) {
    return { statusCode: 200, body: JSON.stringify({ success: true, status: donation.status || 'pending' }) };
  }

  try {
    const result = await verifyInvoice(donation.providerReference);

    await store.setJSON(refCommand, {
      ...donation,
      status: result.status,
      amountConfirmed: result.amount,
      updatedAt: new Date().toISOString(),
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, status: result.status, amount: donation.amount }) };
  } catch (err) {
    console.error('Erreur confirm-payment:', err);
    // On ne bloque pas l'affichage de la page si PayDunya est temporairement
    // injoignable : on renvoie le dernier statut connu.
    return { statusCode: 200, body: JSON.stringify({ success: true, status: donation.status || 'pending', amount: donation.amount }) };
  }
};