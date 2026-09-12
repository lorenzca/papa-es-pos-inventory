const auditModel = require('../models/auditModel');

// loads the last 200 logs and dispalys them
async function getAudit(req, res) {
  try {
    const rawLogs = await auditModel.listAudit({ limit: 200 });

    // turn saved JSON into readable text 
    const logs = rawLogs.map((log) => {
      let parsedDetails = null;
      if (log.details) {
        try {
          parsedDetails = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        } catch (e) {
          parsedDetails = { raw: log.details };
        }
      }
      return {
        ...log,
        parsedDetails
      };
    });

    res.render('audit', { user: req.session.user, logs });
  } catch (error) {
    console.error('[audit] failed to load audit logs:', error.message);
    res.render('audit', { user: req.session.user, logs: [], error: 'Could not load audit logs.' });
  }
}

module.exports = { getAudit };