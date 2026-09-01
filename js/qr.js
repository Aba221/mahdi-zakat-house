const qrImg = document.getElementById('qrCode');
if (qrImg) {
  const donUrl = `${window.location.origin}/#don`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&color=32-41-28&bgcolor=250-246-236&data=${encodeURIComponent(donUrl)}`;
}
