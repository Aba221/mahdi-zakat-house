// netlify/functions/lib/donations-store.js
// Enveloppe sûre autour de Netlify Blobs pour le store "donations".
// getStore() peut lever une erreur synchrone si Netlify Blobs n'est pas
// disponible dans cet environnement (MissingBlobsEnvironmentError) — le
// paiement lui-même ne doit JAMAIS dépendre de la réussite du stockage.
// Toutes les fonctions ci-dessous avalent l'erreur et renvoient une valeur
// neutre (null / false / tableau vide) au lieu de laisser planter l'appelant.

const { getStore } = require('@netlify/blobs');

function safeGetStore() {
  try {
    // Configuration manuelle (BLOBS_SITE_ID / BLOBS_TOKEN) en repli, si
    // jamais connectLambda() (appelé dans chaque fonction avant celle-ci)
    // ne suffisait pas sur ce compte.
    const siteID = process.env.BLOBS_SITE_ID;
    const token = process.env.BLOBS_TOKEN;
    if (siteID && token) {
      return getStore({ name: 'donations', siteID, token });
    }
    return getStore('donations');
  } catch (err) {
    console.error('Netlify Blobs indisponible (getStore):', err.message);
    return null;
  }
}

async function saveDonation(refCommand, data) {
  const store = safeGetStore();
  if (!store) return false;
  try {
    await store.setJSON(refCommand, data);
    return true;
  } catch (err) {
    console.error('Netlify Blobs indisponible (setJSON):', err.message);
    return false;
  }
}

async function getDonation(refCommand) {
  const store = safeGetStore();
  if (!store) return null;
  try {
    return await store.get(refCommand, { type: 'json' });
  } catch (err) {
    console.error('Netlify Blobs indisponible (get):', err.message);
    return null;
  }
}

async function listDonations(limit = 50) {
  const store = safeGetStore();
  if (!store) return [];
  try {
    const { blobs } = await store.list();
    const selected = limit ? blobs.slice(-limit) : blobs;
    const records = await Promise.all(selected.map((b) => store.get(b.key, { type: 'json' })));
    return records.filter(Boolean);
  } catch (err) {
    console.error('Netlify Blobs indisponible (list):', err.message);
    return [];
  }
}

module.exports = { saveDonation, getDonation, listDonations };
