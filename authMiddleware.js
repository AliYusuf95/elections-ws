const { User, Location, AdminUser } = require("./models");

async function isAuthenticated(req, res, next) {
  if (!req.session || req.session.loggedin !== true) {
    return res.status(403).json({message: "You don't have permission"});
  }
  const user = User.findOne({
    where: {
      id: req.session.id
    },
    include: Location
  });
  if (!user) {
    return res.status(403).json({message: "You don't have permission"});
  }
  req.user = user;
  next();
}

async function isAdmin(req, res, next) {
  if (!req.session || req.session.loggedin !== true || req.session.admin !== true) {
    return res.status(403).json({message: "You don't have permission"})
  }
  const user = AdminUser.findOne({
    where: {
      id: req.session.id
    }
  });
  if (!user) {
    return res.status(403).json({message: "You don't have permission"});
  }
  req.user = user;
  next();
}

async function isAuthenticatedOrAdmin(req, res, next) {
  if (!req.session || req.session.loggedin !== true) {
    return res.status(403).json({message: "You don't have permission"})
  }

  let user;
  if (req.session.admin === true) {
    user = AdminUser.findOne({
      where: {
        id: req.session.id
      }
    });
  } else {
    user = User.findOne({
      where: {
        id: req.session.id
      },
      include: Location
    });
  }

  if (!user) {
    return res.status(403).json({message: "You don't have permission"});
  }
  
  req.user = user;
  next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isAuthenticatedOrAdmin
};
