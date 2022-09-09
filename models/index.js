const { Model, DataTypes, Deferrable } = require('sequelize');
const { compareSync, hashSync } = require('bcryptjs');

class Location extends Model {}
class Screen extends Model {}
class User extends Model {
  static hashPassword(password) {
    // hash and convert to php version
    return hashSync(password, 10).replace(/^\$2a(.+)$/i, '$2y$1');
  }

  static isValidPassword(password) {
    return compareSync(password, this.password);
  }

  static isAdmin() {
    return false;
  }
}

class AdminUser extends Model {
  static hashPassword(password) {
    // hash and convert to php version
    return hashSync(password, 10).replace(/^\$2a(.+)$/i, '$2y$1');
  }

  static isValidPassword(password) {
    return compareSync(password, this.password);
  }

  static isAdmin() {
    return true;
  }
}
class Voter extends Model {}

async function initModels(sequelize) {
  Location.init(
    {
      name: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: 'locations',
      modelName: 'location',
    }
  );

  Screen.init(
    {
      name: DataTypes.STRING,
      sessionId: DataTypes.STRING,
      code: DataTypes.STRING,
      connected: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      tableName: 'screens',
      modelName: 'screen',
      indexes: [
        {
          unique: true,
          fields: ['sessionId'],
        },
        {
          unique: true,
          fields: ['code'],
        },
      ],
    }
  );

  Screen.Location = Screen.belongsTo(Location);
  Location.Screen = Location.hasMany(Screen);

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'users_new',
      modelName: 'user',
      hooks: {
        beforeCreate: (user) => {
          user.password = hashSync(user.password, 10);
        },
      },
    }
  );

  User.Location = User.belongsTo(Location);
  Location.User = Location.hasMany(User);

  AdminUser.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'admin_users',
      modelName: 'adminUser',
    }
  );

  Voter.init(
    {
      name: DataTypes.STRING,
      cpr: DataTypes.INTEGER(9),
      mobile: DataTypes.INTEGER(11),
      fromwhere: DataTypes.STRING,
      status: DataTypes.INTEGER(11),
      unique_key: DataTypes.STRING,
      notes: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: 'voters_new',
      modelName: 'voter',
    }
  );

  Voter.Location = Voter.belongsTo(Location);
  Location.Voter = Location.hasMany(Voter);
  Voter.User = Voter.belongsTo(User);
  User.Voter = User.hasMany(Voter);
}

module.exports = {
  initModels,
  Location,
  Screen,
  User,
  AdminUser,
  Voter,
};
