const { Model, DataTypes, Deferrable } = require("sequelize");

class Location extends Model {}
class Screen extends Model {}

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
}

module.exports = {
  initModels,
  Location,
  Screen
};
