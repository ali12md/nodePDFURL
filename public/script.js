async function generate() {
  const url = document.getElementById('url').value;
  const status = document.getElementById('status');
  status.textContent = 'Processing...';

  try {
    const response = await fetch('/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) throw new Error('Failed');

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'output.pdf';
    link.click();

    status.textContent = '✅ PDF generated!';
  } catch (err) {
    console.error(err);
    status.textContent = '❌ Failed to generate PDF';
  }
}
