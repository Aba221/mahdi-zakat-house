// netlify/functions/confirm-payment.js
// Appelée par merci.html quand le donateur revient de PayDunya.
// Reprend le principe de confirmCheckout() (BRVM Analyst Pro) : le
// paramètre d'URL "ref" ne sert qu'à retrouver la transaction, jamais à
// décider du statut — on revérifie toujours réellement auprès de PayDunya.

const { verifyInvoice } = require('./lib/paydunya');
const { getDonation, saveDonation } = require('./lib/donations-store');

exports.handler = async (event) => {
  const refCommand = event.queryStringParameters && event.queryStringParameters.ref;
  if (!refCommand) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Référence manquante.' }) };
  }

  const donation = await getDonation(refCommand);

  // Si le stockage est indisponible ou que l'enregistrement est introuvable,
  // on ne peut pas retrouver le token PayDunya : on l'indique clairement
  // plutôt que de laisser croire à un échec de paiement.
  if (!donation) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, status: 'unknown', message: "Statut introuvable, contactez-nous avec votre référence." }),
    };
  }

  if (donation.status === 'completed' || donation.status === 'paid') {
    return { statusCode: 200, body: JSON.stringify({ success: true, status: 'completed', amount: donation.amount }) };
  }

  if (!donation.providerReference) {
    return { statusCode: 200, body: JSON.stringify({ success: true, status: donation.status || 'pending' }) };
  }

  try {
    const result = await verifyInvoice(donation.providerReference);
    await saveDonation(refCommand, { ...donation, status: result.status, amountConfirmed: result.amount, updatedAt: new Date().toISOString() });
    return { statusCode: 200, body: JSON.stringify({ success: true, status: result.status, amount: donation.amount }) };
  } catch (err) {
    console.error('Erreur confirm-payment:', err);
    return { statusCode: 200, body: JSON.stringify({ success: true, status: donation.status || 'pending', amount: donation.amount }) };
  }
};