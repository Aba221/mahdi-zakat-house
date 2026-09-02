// netlify/functions/payment-webhook.js
// Reçoit la notification instantanée (IPN) de PayDunya.
// Principe repris de PaymentsService.confirmTransaction() (BRVM Analyst Pro) :
// on n'extrait du corps de la requête QUE la référence (le token), jamais le
// statut lui-même — le statut réel est toujours revérifié auprès de
// PayDunya via verifyInvoice().

const { getStore } = require('@netlify/blobs');
const { verifyInvoice } = require('./lib/paydunya');

function parseBody(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;

  if (contentType.includes('application/json')) {
    return JSON.parse(raw || '{}');
  }

  // PayDunya envoie parfois en x-www-form-urlencoded avec un champ "data"
  // contenant le JSON de la facture.
  const params = new URLSearchParams(raw || '');
  if (params.has('data')) {
    try {
      return { data: JSON.parse(params.get('data')) };
    } catch {
      return {};
    }
  }
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

function extractToken(body) {
  return (body && body.data && body.data.invoice && body.data.invoice.token) || null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée' };
  }

  let body;
  try {
    body = parseBody(event);
  } catch (e) {
    return { statusCode: 400, body: 'Webhook KO - corps invalide' };
  }

  const token = extractToken(body);
  if (!token) {
    // On répond 200 quand même pour éviter que PayDunya ne renvoie en boucle
    // une notification qu'on ne sait de toute façon pas traiter.
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  try {
    const result = await verifyInvoice(token);
    const refCommand = result.internalReference;
    if (!refCommand) return { statusCode: 200, body: JSON.stringify({ received: true }) };

    const store = getStore('donations');
    const existing = (await store.get(refCommand, { type: 'json' })) || {};

    await store.setJSON(refCommand, {
      ...existing,
      refCommand,
      status: result.status,
      amountConfirmed: result.amount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur vérification webhook PayDunya:', err);
    // On répond 200 pour éviter une boucle de retries agressive ; l'erreur
    // est loguée côté Netlify pour investigation.
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};