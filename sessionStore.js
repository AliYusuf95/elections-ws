const { getLogger } = require("./logger");

/* abstract */ class SessionStore {
  async findSession(id) {}
  async deleteSession(id) {}
  async saveSession(id, session) {}
  async findAllSessions() {}
}

class InMemorySessionStore extends SessionStore {
  constructor() {
    super();
    this.logger = getLogger('InMemorySessionStore');
    this.sessions = new Map();
  }

  async findSession(id) {
    this.logger.debug(`find session with id={${id}}`);
    return this.sessions.get(id);
  }

  async deleteSession(id) {
    this.logger.debug(`delete session with id={${id}}`);
    this.sessions.delete(id);
  }

  async saveSession(id, session) {
    this.logger.debug(`save session with id={${id}}, data=${JSON.stringify(session)}`);
    this.sessions.set(id, {id: (this.sessions.size + 1), ...session});
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
    this.logger = getLogger('MySqlSessionStore');
    this.sessionModel = sessionModel;
  }

  async findSession(id) {
    this.logger.debug(`find session with id={${id}}`);
    return await this.sessionModel.findOne({
      attributes: ["id", "sessionId", "connected"],
      where: {
        sessionId: id
      }
    });
  }

  async deleteSession(id) {
    this.logger.debug(`delete session with id={${id}}`);
    return await this.sessionModel.destroy({
      where: {
        sessionId: id
      }
    });
  }

  async saveSession(id, { connected }) {
    this.logger.debug(`save session with id={${id}}, data={${JSON.stringify(session)}}`);
    await this.sessionModel.findOrCreate({
      where: { sessionId: id },
      defaults: {
        sessionId: id,
        connected
      }
    });
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
