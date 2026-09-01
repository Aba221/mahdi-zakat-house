// netlify/functions/recent-donations.js
// Expose une liste anonymisée (prénom + montant) des derniers dons confirmés,
// pour le ticker de preuve sociale. Lecture seule, aucune donnée sensible exposée
// (pas de téléphone, pas d'email, pas de nom complet).

const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore('donations');
    const { blobs } = await store.list();

    const records = await Promise.all(
      blobs.slice(-50).map((b) => store.get(b.key, { type: 'json' }))
    );

    const donations = records
      .filter((r) => r && r.status === 'paid')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 10)
      .map((r) => ({
        nom: r.nom,
        amount: r.amount,
        method: r.method,
        poche: r.poche,
        updatedAt: r.updatedAt || r.createdAt,
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({ donations }),
    };
  } catch (err) {
    console.error('Erreur lecture dons récents:', err);
    return { statusCode: 200, body: JSON.stringify({ donations: [] }) };
  }
};
