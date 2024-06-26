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
class VotingResults extends Model {}
class VotingSubmissions extends Model {}
class Voter extends Model {}
class VoterData extends Model {}
class Position extends Model {}
class SystemLog extends Model {}

const voterAttributes = {
  name: DataTypes.STRING,
  cpr: {
    type: DataTypes.STRING(9),
    allowNull: false,
  },
  mobile: DataTypes.STRING,
  fromwhere: DataTypes.STRING,
  // status: DataTypes.INTEGER(11),
  // unique_key: DataTypes.STRING,
  notes: DataTypes.STRING,
};

async function initModels(sequelize) {
  Location.init(
    {
      name: DataTypes.STRING,
      open: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
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
      ...voterAttributes,
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

  VoterData.init(
    {
      ...voterAttributes,
      status: DataTypes.INTEGER(11),
    },
    {
      sequelize,
      tableName: 'voters_data',
      modelName: 'voterData',
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
      cpr: {
        type: DataTypes.STRING(9),
        allowNull: false,
        unique: true,
      },
      img: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: 'candidates',
      modelName: 'candidate',
    }
  );

  Position.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      maxVotes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
      }
    },
    {
      sequelize,
      tableName: 'positions',
      modelName: 'position',
    }
  );

  VotingResults.init(
    {
      votes: {
        type: DataTypes.INTEGER(11),
        defaultValue: 0,
      },
    },
    {
      sequelize,
      tableName: 'voting_results',
      modelName: 'voting_results',
    }
  );

  VotingSubmissions.init(
    {
      submission: {
        type: DataTypes.JSON,
        allowNull: false,
      }
    },
    {
      sequelize,
      tableName: 'voting_submissions',
      modelName: 'voting_submissions',
    }
  );

  SystemLog.init(
    {
      title: DataTypes.STRING,
      username: DataTypes.STRING,
      created_at: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: 'system_log',
      modelName: 'system_log',
      updatedAt: false,
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

  VoterData.belongsTo(Location);
  Location.hasMany(VoterData);
  VoterData.belongsTo(User);
  VoterData.belongsTo(Voter);
  User.hasMany(VoterData);
  Candidate.hasMany(VotingResults, {
    onDelete: 'CASCADE',
  });
  Candidate.belongsTo(Position, {
    onDelete: 'CASCADE',
  });
}

module.exports = {
  initModels,
  Location,
  Screen,
  User,
  AdminUser,
  Voter,
  VoterData,
  Candidate,
  VotingResults,
  VotingSubmissions,
  Position,
  SystemLog,
};
