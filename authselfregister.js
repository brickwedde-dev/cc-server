const crypto = require('crypto');
const { getBearerFromReq } = require('./authsimple.js');

class AuthSelfRegisterPlugin {
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

  getsession (oInfo, req, res, method) {
    return new Promise((resolve, reject) => {
      console.log("method:" + method + ".");
      if (method == "login" || method == "selfregister") {
        resolve(oInfo);
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
                    resolve(oInfo);
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

  checksession (oInfo, req, res, user, method) {
    if (method == "login" || method == "selfregister") {
      return Promise.resolve(oInfo);
    }
    if (!oInfo.session) {
      return Promise.reject("Unauthorized");
    }
    return Promise.resolve(oInfo);
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
            const session = { userid: users[0]._id, username, timestamp: Date.now(), sessionkey };
            this.storage.api.addObject(null, this.sessionsType, session)
              .then((ok) => {
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

  selfregister (oInfo, username) {
    return new Promise((resolve, reject) => {
      this.storage.api.getObjectByField(null, this.usersType, "username", username)
      .then((users) => {
        if (!users || users.length == 0) {
          var password = "1234";
          var hash = crypto.createHash('sha256');
          hash.update(`${username}:${password}:v1`);
          var secret = hash.digest('hex');
          var user = { username, secrettype : "password", secret };
          this.storage.api.addObject(null, this.usersType, user)
          .then(() => {
            console.log (`User with password '${password}' created`);
            resolve({ok:true});
          })
          .catch((e) => {
            console.error("register error:", e);
            reject (e);
          });
        } else {
          console.error("duplicate user");
          reject(`User ${username} already registered.`);
        }
      })
      .catch((e) => {
        console.error("register error:", e);
        reject(`Register ${username}' failed`);
      });
    })
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

  listUsers(oInfo) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return this.storage.api.listObjects(oInfo, this.usersType);
  }

  addUser(oInfo, user) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return this.storage.api.addObject(oInfo, this.usersType, user);
  }

  updateUser(oInfo, user) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return this.storage.api.updateObject(oInfo, this.usersType, user);
  }

  deleteUser(oInfo, id) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return this.storage.api.deleteObject(oInfo, this.usersType, id);
  }

  resetUserPassword(oInfo, user) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return new Promise((resolve, reject) => {
      this.storage.api.getObjectByField(null, this.usersType, "_id", user._id)
        .then((users) => {
          if (users.length > 0 && users[0].secrettype == `password`) {
            const hash = crypto.createHash('sha256');
            hash.update(user.username + "::v1");
            users[0].secret = hash.digest('hex');
            this.storage.api.updateObject(oInfo, this.usersType, users[0])
              .then(() => {
                resolve(true);
              })
              .catch((e) => {
                reject(`Resetting password '${user.username}' failed 3`);
              });
          } else {
            reject(`Resetting password '${user.username}' failed 2`);
          }
        })
        .catch((e) => {
          reject(`Resetting password '${user.username}' failed 1 ` + e);
        });
    });
  }
}

module.exports = { AuthSelfRegisterPlugin, getBearerFromReq };