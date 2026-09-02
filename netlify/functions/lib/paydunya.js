// netlify/functions/lib/paydunya.js
// Client PayDunya partagé, adapté du PayDunyaProvider validé en sandbox
// sur BRVM Analyst Pro (payments/providers/paydunya.provider.ts).
// Principe conservé : createInvoice() crée le lien de paiement,
// verifyInvoice() revérifie TOUJOURS le statut réel auprès de PayDunya —
// jamais de confiance aveugle dans un webhook ou un paramètre d'URL.

function baseUrl() {
  const mode = process.env.PAYDUNYA_MODE || 'sandbox';
  return mode === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';
}

function headers() {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;

  if (!masterKey || !privateKey || !token) {
    throw new Error('PayDunya : clés API manquantes (PAYDUNYA_MASTER_KEY / PAYDUNYA_PRIVATE_KEY / PAYDUNYA_TOKEN).');
  }

  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': masterKey,
    'PAYDUNYA-PRIVATE-KEY': privateKey,
    'PAYDUNYA-TOKEN': token,
  };
}

/**
 * Crée une facture PayDunya et renvoie l'URL de paiement à laquelle
 * rediriger le donateur.
 */
async function createInvoice({
  amount,
  description,
  customerName,
  customerEmail,
  customerPhone,
  internalReference,
  returnUrl,
  cancelUrl,
  callbackUrl,
}) {
  const res = await fetch(`${baseUrl()}/checkout-invoice/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      invoice: {
        total_amount: Math.round(amount),
        description,
        customer: {
          name: customerName,
          email: customerEmail || '',
          phone: customerPhone || '',
        },
      },
      store: {
        name: 'Mahdi Zakat House',
      },
      custom_data: {
        internal_reference: internalReference,
      },
      actions: {
        cancel_url: cancelUrl,
        return_url: returnUrl,
        callback_url: callbackUrl,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok || data.response_code !== '00') {
    throw new Error(`PayDunya : impossible de créer le lien de paiement (${data.response_text || res.status}).`);
  }

  return {
    paymentUrl: data.response_text, // PayDunya renvoie l'URL de paiement dans response_text
    providerReference: data.token,
  };
}

const STATUS_MAP = {
  pending: 'pending',
  completed: 'completed',
  cancelled: 'cancelled',
  failed: 'failed',
};

/**
 * Revérifie le statut réel d'une facture auprès de PayDunya (jamais à
 * partir du seul contenu d'un webhook ou d'une redirection).
 */
async function verifyInvoice(providerReference) {
  const res = await fetch(`${baseUrl()}/checkout-invoice/confirm/${providerReference}`, {
    method: 'GET',
    headers: headers(),
  });

  const data = await res.json();

  if (!res.ok || data.response_code !== '00') {
    throw new Error(`PayDunya : impossible de vérifier le paiement (${data.response_text || res.status}).`);
  }

  return {
    status: STATUS_MAP[data.status] || 'pending',
    amount: data.invoice ? data.invoice.total_amount : undefined,
    internalReference: data.custom_data ? data.custom_data.internal_reference : undefined,
  };
}

module.exports = { createInvoice, verifyInvoice };