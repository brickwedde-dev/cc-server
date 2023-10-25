const crypto = require('crypto');
const { getBearerFromReq, AuthSimpleApi } = require('./authsimple.js');
const jwt = require('jsonwebtoken');
const { sendmail } = require('../sendmail.js');
var { WebserverResponse } = require('../cc-webserver/webserver4.js');

class AuthSelfRegisterPlugin {
  constructor(storagePlugin, registerType, usersType, sessionsType, options) {
    this.options = options || {};
    this.usersType = usersType;
    this.registerType = registerType;
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
    this.api = new AuthSelfRegisterApi(this, this.registerType, this.storage, usersType, sessionsType, this.options);
  }

  getsession (oInfo, req, res, method) {
    return new Promise((resolve, reject) => {
      console.log("method:" + method + ".");
      if (method == "login" || method == "selfregister" || method == "certlogin") {
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
              resolve(sessions[0]);
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
    if (method == "login" || method == "selfregister" || method == "certlogin") {
      return Promise.resolve(oInfo);
    }
    if (!oInfo.session) {
      return Promise.reject("Unauthorized");
    }
    return Promise.resolve(oInfo);
  }
}

class AuthSelfRegisterApi extends AuthSimpleApi {
  constructor (plugin, registerType, storagePlugin, usersType, sessionsType, options) {
    super(plugin, storagePlugin, usersType, sessionsType);
    this.options = options;
    this.registerType = registerType;
  }

  checksession(oInfo) {
    return Promise.resolve(oInfo);
  }

  certlogin (oInfo, cert) {
    return new Promise((resolve, reject) => {
      jwt.verify(cert, this.options.secret || "TheSecret", (err, decoded) => {
        if (err) {
          reject ("Not authorized");
        } else {
          const hash = crypto.createHash('sha256');
          hash.update(decoded.sub + "SessionKey" + Date.now());
          const sessionkey = hash.digest('hex');
          const session = { userid: decoded.sub, username: decoded.sub, timestamp: Date.now(), sessionkey };
          this.storage.api.addObject(null, this.sessionsType, session)
          .then((ok) => {
            resolve(session);
          })
          .catch((e) => {
            reject(`Auth '${decoded.sub}' with cert failed, session-db:` + e);
          });
        }
      });
    });
  }

  selfregister (oInfo, username) {
    return new Promise((resolve, reject) => {
      this.storage.api.getObjectByField(null, this.usersType, "username", username)
      .then((users) => {
        switch (this.registerType) {
          case "emaillogin":
            jwt.sign({
              iss: 'AuthSelfRegisterApi',
              sub: `email:${username}`,
              iat: parseInt(new Date().getTime()/1000),
              exp: parseInt(new Date().getTime()/1000) + 3600,
              aud: `email:${username}`,
            }, this.options.secret || "TheSecret" , undefined, (err, cert) => {
              if (err) {
                reject("Failed creating token")
              } else {
                let message = {
                    to: username,
                    subject: 'Your self registration',
                    text: `Click on http://127.0.0.1/jwtcert.html?/loginlink#${cert} to log in`,
                    html: `Click on <a href="http://127.0.0.1/certlogin.html?/loginlink#${cert}">this link</a> to log in`,
                    attachments: []
                };

                console.log (`User '${username}' email cert '${cert}' created`);

                var emailaccount = this.options.emailaccount || {
                    smtp : {
                        host : "127.0.0.1",
                        port : 25,
                        secure : false,
                    },
                    user : "username",
                    pass : "password",
                    from : "email@domain",
                }

                sendmail(emailaccount, message)
//                Promise.resolve()
                .then(() => {
                  resolve({ok:true});
                })
                .catch((e) => {
                  reject("Sending mail failed");
                })
              }
            });
            break;

          case "createpassword":
            if (!users || users.length == 0) {
              var password = crypto.createHash('sha256').update(`Some timestamp ${new Date().getTime()}`).digest('hex').substring(0, 10);
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
            break;
        }
      })
      .catch((e) => {
        console.error("register error:", e);
        reject(`Register ${username}' failed`);
      });
    })
  }
}

module.exports = { AuthSelfRegisterPlugin, getBearerFromReq };