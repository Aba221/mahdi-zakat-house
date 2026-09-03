// netlify/functions/admin-donations.js
// Renvoie la liste complète des dons (avec noms/téléphones) pour le
// tableau de bord admin. PROTÉGÉE : nécessite une session Netlify Identity
// valide, vérifiée côté serveur — jamais un simple code côté client.
//
// Optionnel : restreindre à une liste d'emails précis via la variable
// d'environnement ADMIN_EMAILS ("vous@exemple.com,associe@exemple.com").
// Sans cette variable, tout compte Identity invité sur le site a accès.

const { listDonations } = require('./lib/donations-store');
const { connectLambda } = require('@netlify/blobs');

function getIdentityUser(context) {
  if (!context || !context.clientContext) return null;
  if (context.clientContext.user) return context.clientContext.user;
  const custom = context.clientContext.custom;
  if (custom && custom.netlify) {
    try {
      const decoded = JSON.parse(Buffer.from(custom.netlify, 'base64').toString('utf-8'));
      return decoded.user || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

exports.handler = async (event, context) => {
  connectLambda(event);

  const user = getIdentityUser(context);
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Connexion requise.' }) };
  }

  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length && !allowlist.includes((user.email || '').toLowerCase())) {
    return { statusCode: 403, body: JSON.stringify({ success: false, message: "Ce compte n'a pas accès au tableau de bord." }) };
  }

  const records = await listDonations(0); // toutes les données, pas de limite

  const donations = records
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .map((r) => ({
      refCommand: r.refCommand,
      nom: r.nom,
      tel: r.tel,
      email: r.email,
      amount: r.amount,
      amountConfirmed: r.amountConfirmed,
      method: r.method,
      poche: r.poche,
      frequence: r.frequence,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ success: true, donations }),
  };
};
