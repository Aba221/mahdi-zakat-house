// netlify/functions/stats.js
// Statistiques publiques agrégées, pour le compteur "Total collecté" et la
// répartition par compartiment sur la page d'accueil. Ne renvoie AUCUNE
// donnée personnelle (pas de nom, téléphone, email) — uniquement des
// montants et des comptes.

const { listDonations } = require('./lib/donations-store');
const { connectLambda } = require('@netlify/blobs');

const POCHES = ['A', 'B', 'C', 'D'];

exports.handler = async (event) => {
  connectLambda(event);

  const records = await listDonations(0); // pas de limite : total exact
  const confirmed = records.filter((r) => r && (r.status === 'completed' || r.status === 'paid'));

  const totalsByPoche = { A: 0, B: 0, C: 0, D: 0 };
  let totalAmount = 0;

  for (const r of confirmed) {
    const amount = Number(r.amountConfirmed || r.amount) || 0;
    totalAmount += amount;
    const poche = POCHES.includes(r.poche) ? r.poche : 'A';
    totalsByPoche[poche] += amount;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    body: JSON.stringify({
      totalAmount,
      donorCount: confirmed.length,
      totalsByPoche,
      updatedAt: new Date().toISOString(),
    }),
  };
};
