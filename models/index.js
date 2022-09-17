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
}

class AdminUser extends Model {
  static hashPassword(password) {
    // hash and convert to php version
    return hashSync(password, 10).replace(/^\$2a(.+)$/i, '$2y$1');
  }

  static isValidPassword(password) {
    return compareSync(password, this.password);
  }
}

class Candidate extends Model {}
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
      available: {
        type: DataTypes.VIRTUAL,
        get() {
          return !this.voterId;
        },
        set(value) {
          throw new Error('Do not try to set the `available` value!');
        },
      },
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

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isAdmin: {
        type: DataTypes.VIRTUAL,
        get() {
          return false;
        },
        set(value) {
          throw new Error('Do not try to set the `isAdmin` value!');
        },
      },
    },
    {
      sequelize,
      tableName: 'users',
      modelName: 'user',
    }
  );

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
      isAdmin: {
        type: DataTypes.VIRTUAL,
        get() {
          return true;
        },
        set(value) {
          throw new Error('Do not try to set the `isAdmin` value!');
        },
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
      cpr: DataTypes.STRING(9),
      mobile: DataTypes.STRING,
      fromwhere: DataTypes.STRING,
      status: DataTypes.INTEGER(11),
      unique_key: DataTypes.STRING,
      notes: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: 'voters',
      modelName: 'voter',
      indexes: [
        {
          unique: true,
          fields: ['cpr'],
        },
      ],
    }
  );

  Candidate.init(
    {
      name: DataTypes.STRING,
      cpr: DataTypes.STRING(9),
      img: DataTypes.STRING,
      votes: {
        type: DataTypes.INTEGER(11),
        defaultValue: 0,
      },
    },
    {
      sequelize,
      tableName: 'candidates',
      modelName: 'candidate',
    }
  );

  // relations
  Screen.belongsTo(Location);
  Location.hasMany(Screen);
  Voter.hasOne(Screen);
  Screen.belongsTo(Voter, {
    foreignKey: {
      unique: true,
    },
  });

  User.belongsTo(Location);
  Location.hasMany(User);

  Voter.belongsTo(Location);
  Location.hasMany(Voter);
  Voter.belongsTo(User);
  User.hasMany(Voter);
}

module.exports = {
  initModels,
  Location,
  Screen,
  User,
  AdminUser,
  Voter,
  Candidate,
};
