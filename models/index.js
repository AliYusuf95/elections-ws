const { Model, DataTypes, Deferrable } = require("sequelize");

class Location extends Model {}
class Screen extends Model {}

async function initModels(sequelize) {
  Location.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: DataTypes.TEXT
    },
    {
      sequelize,
      tableName: "locations"
    }
  );

  Screen.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: DataTypes.TEXT,
      sessionId: DataTypes.TEXT,
      code: DataTypes.TEXT,
      connected: DataTypes.BOOLEAN,
      location: {
        type: DataTypes.INTEGER,
        references: {
          model: Location,
          key: "id",
          deferrable: Deferrable.INITIALLY_IMMEDIATE
        }
      }
    },
    {
      sequelize,
      tableName: "screens",
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
}

module.exports = {
  initModels,
  Location,
  Screen
};
