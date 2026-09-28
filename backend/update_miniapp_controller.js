const fs = require('fs');
let content = fs.readFileSync('/var/www/audit_wa/backend/controllers/miniAppController.js', 'utf8');

// Add finishReturn function
const finishReturnFunc = `
/**
 * POST /api/mini-app/retur/:id/finish
 */
async function finishReturn(req, res) {
  try {
    const returnId = req.params.id;
    const tx = await prisma.returnTransaction.update({
      where: { id: returnId },
      data: { status: 'SELESAI' }
    });
    res.json({ success: true, message: 'Retur berhasil diselesaikan dan dikunci', data: tx });
  } catch (err) {
    console.error('[MiniApp] finishReturn error:', err);
    res.status(500).json({ error: 'Gagal menyelesaikan retur: ' + err.message });
  }
}
`;

content = content.replace('module.exports = {', finishReturnFunc + '\nmodule.exports = {');
content = content.replace('printReturn', 'printReturn,\n  finishReturn');
fs.writeFileSync('/var/www/audit_wa/backend/controllers/miniAppController.js', content);
