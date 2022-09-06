const { Model, DataTypes, Deferrable } = require("sequelize");
const { compareSync, hashSync } = require('bcryptjs');

class Location extends Model {}
class Screen extends Model {}
class User extends Model {

  hashPassword(password) {
    // hash and convert to php version
    return hashSync(password, 10).replace(/^\$2a(.+)$/i, '$2y$1');
  }

  isValidPassword(password) {
    return compareSync(password, this.password);
  }

}

class AdminUser extends Model {

  hashPassword(password) {
    // hash and convert to php version
    return hashSync(password, 10).replace(/^\$2a(.+)$/i, '$2y$1');
  }

  isValidPassword(password) {
    return compareSync(password, this.password);
  }

}

async function initModels(sequelize) {
  Location.init(
    {
      name: DataTypes.TEXT
    },
    {
      sequelize,
      tableName: "locations",
      modelName: "location",
    }
  );

  Screen.init(
    {
      name: DataTypes.TEXT,
      sessionId: DataTypes.TEXT,
      code: DataTypes.TEXT,
      connected: DataTypes.BOOLEAN
    },
    {
      sequelize,
      tableName: "screens",
      modelName: "screen",
      indexes: [
        {
          unique: true,
          fields: ["sessionId"]
        },
        {
          unique: true,
          fields: ["code"]
        }
      ]
    }
  );

  Screen.Location = Screen.belongsTo(Location);
  Location.Screen = Location.hasMany(Screen);

  User.init(
    {
      username: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      password: {
        type: DataTypes.TEXT,
        allowNull: false
      },
    },
    {
      sequelize,
      tableName: 'users_new',
      modelName: "user",
      hooks: {
        beforeCreate: (user) => {
          user.password = hashSync(user.password, 10);
        },
      }
    }
  );

  
  User.Location = User.belongsTo(Location);
  Location.User = Location.hasMany(User);

  AdminUser.init(
    {
      username: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      password: {
        type: DataTypes.TEXT,
        allowNull: false
      },
    },
    {
      sequelize,
      tableName: 'admin_users',
      modelName: "adminUser",
    }
  );

}

module.exports = {
  initModels,
  Location,
  Screen,
  User,
  AdminUser
};
