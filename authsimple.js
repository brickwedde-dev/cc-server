const crypto = require('crypto');

function getBearerFromReq (req) {
  var bearer = null;
  if (req.headers.authorization && req.headers.authorization.indexOf('Bearer ') === 0) {
    bearer = req.headers.authorization.substring(7);
  } else if (req.url.indexOf('?bearer=') >= 0) {
    var i = req.url.indexOf('?bearer=');
    var bearer = req.url.substring(i + 8);
    i = bearer.indexOf("&");
    if (i >= 0) {
      bearer = bearer.substring(0, i);
    }
  }
  return bearer;
}

class AuthSimplePlugin {
  constructor(storagePlugin, usersType, sessionsType) {
    this.usersType = usersType;
    this.sessionsType = sessionsType;
    this.storage = storagePlugin;
    this.storage.api.getObjectByField(null, this.usersType, "username", "admin")
      .then((users) => {
        if (users.length == 0) {
          const hash = crypto.createHash('sha256');
          hash.update("admin::v1");
          const pw = hash.digest('hex');
          this.storage.api.addObject(null, this.usersType, { username: `admin`, forename: `Admin`, surname: `User`, secrettype: `password`, secret: pw, features: { "admin": true } });
        }
      })
      .catch((e) => {
      });
    this.api = new AuthSimpleApi(this, this.storage, usersType, sessionsType);
  }

  checksession (oInfo, req, res, method) {
    return new Promise((resolve, reject) => {
      if (method == "login") {
        resolve();
        return;
      }
      var bearer = getBearerFromReq(req);
      if (bearer) {
        this.storage.api.getObjectByField(null, this.sessionsType, "sessionkey", bearer)
          .then((sessions) => {
            if (sessions.length > 0) {
              if (method == "invalidatesession") {
                this.storage.api.deleteObject(null, this.sessionsType, sessions[0]._id)
                  .then(() => {
                    reject();
                  }).catch((e) => {
                    reject();
                  });
                return;
              }
              oInfo.session = sessions[0];
              this.storage.api.getObjectByField(null, this.usersType, "username", oInfo.session.username)
                .then((users) => {
                  if (users.length > 0) {
                    oInfo.user = users[0];
                    resolve();
                  } else {
                    reject(`Session got invalid, user removed`);
                  }
                })
                .catch((e) => {
                  reject(`Session invalid: ` + e);
                });
            } else {
              reject(`No session found`);
            }
          })
          .catch((e) => {
            reject(`No session found, ` + e);
          });
        return;
      }
      if (req.headers.authorization && req.headers.authorization.indexOf('Basic ') === 0) {
        reject(`Basic unsupported`);
        return;
      }
      reject(`No Headers found`);
      return;
    });
  }
}

class AuthSimpleApi {
  constructor(plugin, storage, usersType, sessionsType) {
    this.usersType = usersType;
    this.sessionsType = sessionsType;
    this.plugin = plugin;
    this.storage = storage;
  }

  invalidatesessionkey (oInfo) {
    return true;
  }

  checksessionkey (oInfo) {
    return oInfo;
  }

  login (oInfo, username, password) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      hash.update(`${username}:${password}:v1`);
      password = hash.digest('hex');
      this.storage.api.getObjectByField(null, this.usersType, "username", username)
        .then((users) => {
          if (users.length > 0 && users[0].secrettype == `password` && users[0].secret == password) {
            const hash = crypto.createHash('sha256');
            hash.update(username + "SessionKey" + Date.now());
            const sessionkey = hash.digest('hex');
            this.storage.api.addObject(null, this.sessionsType, { userid: users[0]._id, username, timestamp: Date.now(), sessionkey })
              .then((session) => {
                resolve(session);
              })
              .catch((e) => {
                reject(`Auth '${username}' with '${password}' failed, session-db:` + e);
              });
          } else {
            reject(`Auth '${username}' with '${password}' failed 2`);
          }
        })
        .catch((e) => {
          reject(`Auth '${username}' with '${password}' failed 1`);
        });
    });
  }

  changepassword (oInfo, oldpassword, newpassword) {
    return new Promise((resolve, reject) => {
      var hash = crypto.createHash('sha256');
      hash.update(`${oInfo.session.username}:${oldpassword}:v1`);
      var secret = hash.digest('hex');
      console.log({ secret, _id: oInfo.session.userid });
      this.storage.api.getObjectByField(null, this.usersType, "_id", oInfo.session.userid)
        .then((users) => {
          if (users.length > 0 && users[0].secrettype == `password` && users[0].secret == secret) {
            var hash = crypto.createHash('sha256');
            hash.update(`${oInfo.session.username}:${newpassword}:v1`);
            users[0].secret = hash.digest('hex');
            this.storage.api.updateObject(null, this.usersType, users[0])
              .then(() => {
                resolve(true);
              })
              .catch((e) => {
                reject(`Changing password auth '${oInfo.session.username}' failed 3`);
              });
          } else {
            reject(`Changing password auth '${oInfo.session.username}' failed 2`);
          }
        })
        .catch((e) => {
          reject(`Changing password auth '${oInfo.session.username}' failed 1`);
        });
    });
  }
}

module.exports = { AuthSimplePlugin, getBearerFromReq };