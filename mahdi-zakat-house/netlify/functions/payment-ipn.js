// netlify/functions/payment-ipn.js
// Reçoit les notifications instantanées de paiement (IPN) de PayTech.
// Vérifie l'authenticité via HMAC-SHA256 (méthode recommandée), avec repli sur SHA256 des clés.
// Doc officielle : https://docs.intech.sn/doc_paytech.php#ipnfonctionment

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

function parseBody(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;

  if (contentType.includes('application/json')) {
    return JSON.parse(raw || '{}');
  }
  // Par défaut PayTech envoie en application/x-www-form-urlencoded
  const params = new URLSearchParams(raw || '');
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée' };
  }

  const API_KEY = process.env.PAYTECH_API_KEY;
  const API_SECRET = process.env.PAYTECH_API_SECRET;

  let data;
  try {
    data = parseBody(event);
  } catch (e) {
    return { statusCode: 400, body: 'IPN KO - corps invalide' };
  }

  const {
    type_event,
    ref_command,
    item_price,
    final_item_price,
    custom_field,
    payment_method,
    client_phone,
    api_key_sha256,
    api_secret_sha256,
    hmac_compute,
  } = data;

  let authentic = false;

  if (hmac_compute) {
    const message = `${final_item_price || item_price}|${ref_command}|${API_KEY}`;
    const expectedHmac = crypto.createHmac('sha256', API_SECRET).update(message).digest('hex');
    authentic = expectedHmac === hmac_compute;
  } else {
    const expectedKeyHash = crypto.createHash('sha256').update(API_KEY || '').digest('hex');
    const expectedSecretHash = crypto.createHash('sha256').update(API_SECRET || '').digest('hex');
    authentic = expectedKeyHash === api_key_sha256 && expectedSecretHash === api_secret_sha256;
  }

  if (!authentic) {
    console.warn('IPN PayTech rejetée - signature invalide', { ref_command });
    return { statusCode: 403, body: 'IPN KO - signature invalide' };
  }

  try {
    const store = getStore('donations');
    const existing = (await store.get(ref_command, { type: 'json' })) || {};

    const status = type_event === 'sale_complete' ? 'paid' : type_event === 'sale_canceled' ? 'canceled' : existing.status || 'unknown';

    await store.setJSON(ref_command, {
      ...existing,
      refCommand: ref_command,
      status,
      paymentMethod: payment_method || existing.method,
      clientPhone: client_phone,
      amountConfirmed: final_item_price || item_price,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur mise à jour don (Netlify Blobs):', err);
    // On répond quand même 200 pour éviter que PayTech ne renvoie l'IPN en boucle
  }

  return { statusCode: 200, body: 'IPN OK' };
};
