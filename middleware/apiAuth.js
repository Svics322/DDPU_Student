export const ensureApiAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Помилка автентифікації: для доступу до цього ресурсу потрібен вхід у систему.'
  });
};

export const ensureApiRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Помилка автентифікації: для доступу до цього ресурсу потрібен вхід у систему.'
      });
    }

    if (roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Доступ заборонено: ваша роль не має достатньо прав для виконання цієї дії.',
      requiredRoles: roles,
      currentRole: req.user.role
    });
  };
};
