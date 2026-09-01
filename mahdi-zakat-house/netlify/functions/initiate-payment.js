// netlify/functions/initiate-payment.js
// Initialise une demande de paiement PayTech (Wave, Orange Money, Free Money, Carte Bancaire)
// Doc officielle : https://docs.intech.sn/doc_paytech.php

const { getStore } = require('@netlify/blobs');

const METHOD_MAP = {
  'Wave': 'Wave',
  'Orange Money': 'Orange Money',
  'Free Money': 'Free Money',
  'Carte bancaire': 'Carte Bancaire',
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
  const POCHE_LABELS = {
    A: 'Zakat / Solidarité',
    B: 'Soudure / Résilience',
    C: 'Capital productif',
    D: 'Contribution volontaire',
  };
  const pocheLabel = POCHE_LABELS[poche] || POCHE_LABELS.A;

  const numAmount = Math.round(Number(amount));
  if (!numAmount || numAmount < 500) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Montant invalide (500 FCFA minimum).' }) };
  }
  if (!method || !METHOD_MAP[method]) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Moyen de paiement invalide.' }) };
  }
  if (!nom || !tel) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Nom et téléphone requis.' }) };
  }

  const API_KEY = process.env.PAYTECH_API_KEY;
  const API_SECRET = process.env.PAYTECH_API_SECRET;
  const ENV = process.env.PAYTECH_ENV || 'test'; // 'test' tant que le compte n'est pas validé en prod
  const SITE_URL = process.env.SITE_URL || `https://${event.headers.host}`;

  if (!API_KEY || !API_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Le paiement n'est pas encore configuré (clés PayTech manquantes). Contactez l'administrateur du site.",
      }),
    };
  }

  const refCommand = `MZH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const customField = JSON.stringify({ nom, tel, email: email || '', method, poche, frequence });

  const params = {
    item_name: `${pocheLabel} - Mahdi Zakat House`,
    item_price: numAmount,
    currency: 'XOF',
    ref_command: refCommand,
    command_name: `Don ${pocheLabel} de ${nom}`,
    target_payment: METHOD_MAP[method],
    env: ENV,
    ipn_url: `${SITE_URL}/api/payment-ipn`,
    success_url: `${SITE_URL}/merci.html`,
    cancel_url: `${SITE_URL}/don-annule.html`,
    custom_field: customField,
  };

  try {
    const response = await fetch('https://paytech.sn/api/payment/request-payment', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        API_KEY: API_KEY,
        API_SECRET: API_SECRET,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (data.success !== 1) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: data.message || 'Le paiement a été refusé par PayTech.' }) };
    }

    // Enregistrer le don en attente (Netlify Blobs)
    try {
      const store = getStore('donations');
      await store.setJSON(refCommand, {
        refCommand,
        amount: numAmount,
        method,
        poche: poche || 'A',
        frequence: frequence || 'unique',
        nom, tel, email: email || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    } catch (blobErr) {
      // Ne bloque pas le paiement si le stockage échoue - à surveiller dans les logs Netlify
      console.error('Erreur stockage Netlify Blobs:', blobErr);
    }

    let redirectUrl = data.redirect_url;

    // Pré-remplissage automatique si méthode unique (hors carte bancaire)
    const isCard = METHOD_MAP[method] === 'Carte Bancaire';
    const query = new URLSearchParams({
      pn: tel.startsWith('+') ? tel : `+221${tel.replace(/\D/g, '').slice(-9)}`,
      nn: tel.replace(/\D/g, '').slice(-9),
      fn: nom,
      tp: METHOD_MAP[method],
      nac: isCard ? '1' : '1',
    });
    redirectUrl += `?${query.toString()}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, redirect_url: redirectUrl, ref_command: refCommand }),
    };
  } catch (err) {
    console.error('Erreur PayTech:', err);
    return {
      statusCode: 502,
      body: JSON.stringify({ success: false, message: "Impossible de contacter le service de paiement. Réessayez dans un instant." }),
    };
  }
};
