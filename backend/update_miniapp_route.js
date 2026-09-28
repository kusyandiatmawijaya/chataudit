const fs = require('fs');
let content = fs.readFileSync('/var/www/audit_wa/backend/routes/miniApp.js', 'utf8');

content = content.replace('printReturn', 'printReturn,\n  finishReturn');
content = content.replace('module.exports = router;', 'router.post(\'/retur/:id/finish\', validateTelegramWebApp, finishReturn);\n\nmodule.exports = router;');
fs.writeFileSync('/var/www/audit_wa/backend/routes/miniApp.js', content);
