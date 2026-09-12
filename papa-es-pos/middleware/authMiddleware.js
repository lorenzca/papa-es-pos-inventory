// make sure user is logged in
function ensureAuthenticated(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  next();
}

// block access if user role is not allowed
function ensureRole(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.session?.user) return res.redirect('/login');
    if (!allowed.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        message: 'Access denied for your role.',
        user: req.session.user
      });
    }
    next();
  };
}

module.exports = { ensureAuthenticated, ensureRole };