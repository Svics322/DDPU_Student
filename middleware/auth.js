export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/login');
};

export const ensureRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.redirect('/login');
    }

    if (roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).render('common/403.njk', {
      title: 'Доступ заборонено (403)',
      userRole: req.user.role,
      requiredRoles: roles
    });
  };
};

export const forwardAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.user.role === 'admin') {
      return res.redirect('/admin/tables');
    } else if (req.user.role === 'teacher') {
      return res.redirect('/teacher/courses');
    } else {
      return res.redirect('/student/profile');
    }
  }
  return next();
};
