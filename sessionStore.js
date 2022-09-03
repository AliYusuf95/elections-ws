const { QueryTypes } = require("sequelize");
const { getLogger } = require("./logger");

/* abstract */ class SessionStore {
  async findSession(id) {}
  async saveSession(id, session) {}
  async findAllSessions() {}
}

class InMemorySessionStore extends SessionStore {
  constructor() {
    super();
    this.logger = getLogger("InMemorySessionStore");
    this.sessions = new Map();
  }

  async findSession(id) {
    this.logger.debug(`find session with sessionId={${id}}`);
    return this.sessions.get(id);
  }

  async saveSession(id, data) {
    this.logger.debug(
      `save session with sessionId={${id}}, data=${JSON.stringify(data)}`
    );
    this.sessions.set(id, {
      ...data,
      id: this.sessions.size + 1,
      code: id,
      sessionId: id
    });
    return this.sessions.get(id);
  }

  async findAllSessions() {
    this.logger.debug(`find all sessions`);
    return [...this.sessions.values()];
  }
}

class MySqlSessionStore extends SessionStore {
  constructor(sessionModel) {
    super();
    this.logger = getLogger("MySqlSessionStore");
    this.sessionModel = sessionModel;
  }

  async findSession(id) {
    this.logger.debug(`find session with sessionId={${id}}`);
    return await this.sessionModel.findOne({
      attributes: ["id", "code", "sessionId", "connected"],
      where: {
        sessionId: id
      }
    });
  }

  async saveSession(id, { connected }) {
    this.logger.debug(
      `save session with sessionId={${id}}, data=${JSON.stringify({
        connected
      })}`
    );
    const [session, created] = await this.sessionModel.findOrCreate({
      where: { sessionId: id },
      defaults: {
        sessionId: id,
        connected
      }
    });
    if (!created) {
      session.connected = connected;
      await session.save();
    }
    if (!session.code) {
      await this.sessionModel.sequelize.query(
        `UPDATE screens SET code=concat(
        substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', rand(@seed:=round(rand(?)*4294967296))*36+1, 1),
        substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', rand(@seed:=round(rand(@seed)*4294967296))*36+1, 1),
        substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', rand(@seed:=round(rand(@seed)*4294967296))*36+1, 1),
        substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', rand(@seed:=round(rand(@seed)*4294967296))*36+1, 1),
        substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', rand(@seed)*36+1, 1)
      )
      WHERE id=?;`,
        {
          replacements: [session.id, session.id],
          type: QueryTypes.UPDATE
        }
      );
    }
    await session.reload();
    return session;
  }

  async findAllSessions() {
    this.logger.debug(`find all sessions`);
    return await this.sessionModel.findAll({
      attributes: ["id", "sessionId", "connected"]
    });
  }
}
module.exports = {
  InMemorySessionStore,
  MySqlSessionStore
};
