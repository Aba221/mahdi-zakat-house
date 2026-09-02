// netlify/functions/initiate-payment.js
// Initialise un don via PayDunya (architecture reprise de BRVM Analyst Pro :
// on crée toujours la transaction "pending" en base AVANT d'appeler le
// prestataire, pour avoir une référence interne fiable).

const { getStore } = require('@netlify/blobs');
const { createInvoice } = require('./lib/paydunya');

const POCHE_LABELS = {
  A: 'Zakat / Solidarité',
  B: 'Soudure / Résilience',
  C: 'Capital productif',
  D: 'Contribution volontaire',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Méthode non autorisée' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Requête invalide' }) };
  }

  const { amount, method, nom, tel, email, poche, frequence } = payload;
  const pocheLabel = POCHE_LABELS[poche] || POCHE_LABELS.A;

  const numAmount = Math.round(Number(amount));
  if (!numAmount || numAmount < 200) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Montant invalide (200 FCFA minimum).' }) };
  }
  if (!nom || !tel) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Nom et téléphone requis.' }) };
  }

  const SITE_URL = process.env.SITE_URL || `https://${event.headers.host}`;
  const refCommand = `MZH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const store = getStore('donations');

  // Transaction "pending" créée avant l'appel au prestataire.
  try {
    await store.setJSON(refCommand, {
      refCommand,
      amount: numAmount,
      method: method || '',
      poche: poche || 'A',
      frequence: frequence || 'unique',
      nom, tel, email: email || '',
      status: 'pending',
      provider: 'paydunya',
      createdAt: new Date().toISOString(),
    });
  } catch (blobErr) {
    console.error('Erreur stockage Netlify Blobs (avant paiement):', blobErr);
  }

  try {
    const { paymentUrl, providerReference } = await createInvoice({
      amount: numAmount,
      description: `${pocheLabel} - Mahdi Zakat House${method ? ' (préférence : ' + method + ')' : ''}`,
      customerName: nom,
      customerEmail: email,
      customerPhone: tel,
      internalReference: refCommand,
      returnUrl: `${SITE_URL}/merci.html?ref=${refCommand}`,
      cancelUrl: `${SITE_URL}/don-annule.html`,
      callbackUrl: `${SITE_URL}/api/payment-webhook`,
    });

    // On enregistre la référence PayDunya (token) pour pouvoir revérifier
    // le paiement plus tard (webhook ET page de retour).
    try {
      await store.setJSON(refCommand, {
        refCommand,
        amount: numAmount,
        method: method || '',
        poche: poche || 'A',
        frequence: frequence || 'unique',
        nom, tel, email: email || '',
        status: 'pending',
        provider: 'paydunya',
        providerReference,
        createdAt: new Date().toISOString(),
      });
    } catch (blobErr) {
      console.error('Erreur stockage Netlify Blobs (après création facture):', blobErr);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, redirect_url: paymentUrl, ref_command: refCommand }),
    };
  } catch (err) {
    console.error('Erreur PayDunya:', err);
    return {
      statusCode: 502,
      body: JSON.stringify({ success: false, message: err.message || "Impossible de contacter le service de paiement. Réessayez dans un instant." }),
    };
  }
};