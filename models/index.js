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
      location: {
        type: DataTypes.INTEGER,
        references: {
          model: Location,
          key: "id",
          deferrable: Deferrable.INITIALLY_IMMEDIATE
        }
      },
      connected: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      tableName: "screens"
    }
  );
}

module.exports = {
  initModels,
  Location,
  Screen,
};
