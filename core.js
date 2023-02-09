const crypto = require('crypto');

var { createWebserver } = require('./webserver4.js');

var Datastore = require('nedb');
var db = {};
db.users = new Datastore({ filename: './db/users.db', autoload: true });
db.sessions = new Datastore({ filename: './db/sessions.db', autoload: true });

db.users.find({ username: 'admin' }, (err, docs) => {
    if (docs.length == 0) {
        const hash = crypto.createHash('sha256');
        hash.update("admin::v1");
        const pw = hash.digest('hex');
        db.users.insert({username:`admin`, forename:`Admin`, surname:`User`, secrettype:`password`, secret:pw, features:{"admin":true}});
    }
});

class CoreApi {
    checksession(oInfo, req, res, user, method) {
        return new Promise((resolve, reject) => {
            if (method == "login") {
                resolve();
                return;
            }
            var bearer = null;
            if (req.headers.authorization && req.headers.authorization.indexOf('Bearer ') === 0) {
                bearer = req.headers.authorization.substring(7);
            } else if (req.url.indexOf('?bearer=') >= 0) {
                var i = req.url.indexOf('?bearer=');
                bearer = req.url.substring(i + 8);
                i = bearer.indexOf("&");
                if (i >= 0) {
                    bearer = bearer.substring(0, i);
                }
            }
            if (bearer) {
                db.sessions.find({ sessionkey: bearer }, (err, docs) => {
                    if (docs.length > 0) {
                        if (method == "invalidatesessionkey") {
                            db.sessions.remove({_id : docs[0]._id}, (err, docs) => {
                                reject();
                            });
                            return;
                        }

                        oInfo.session = docs[0];
                        db.users.find({ username:oInfo.session.username }, (err, docs) => {
                            if (docs.length > 0) {
                                oInfo.user = docs[0];
                                resolve();
                            } else {
                                reject(`Session got invalid, user removed`);
                            }
                        });
            
                    } else {
                        reject(`No session found`);
                    }
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

    invalidatesessionkey(oInfo) {
        return true;
    }

    checksessionkey(oInfo) {
        return oInfo;
    }

    login(oInfo, username, password) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            hash.update(`${username}:${password}:v1`);
            password = hash.digest('hex');
            
            db.users.find({ username:username, secrettype:`password`, secret:password }, (err, docs) => {
                if (docs.length > 0) {
                    const hash = crypto.createHash('sha256');
                    hash.update(username + "SessionKey" + Date.now());
                    const sessionkey = hash.digest('hex');
    
                    db.sessions.insert({userid:docs[0]._id, username, timestamp: Date.now(), sessionkey}, (err, newdocs) => {
                        if (err) {
                            reject(`Auth '${username}' with '${password}' failed, session-db`);
                        } else {
                            resolve(newdocs);
                        }
                    });
                    return;
                }
                reject(`Auth '${username}' with '${password}' failed`);
            });
        });
    }

    changepassword(oInfo, oldpassword, newpassword) {
        return new Promise((resolve, reject) => {
            var hash = crypto.createHash('sha256');
            hash.update(`${oInfo.session.username}:${oldpassword}:v1`);
            var secret = hash.digest('hex');
            console.log({secret, _id:oInfo.session.userid});
            db.users.find({ _id:oInfo.session.userid, secrettype:`password`, secret }, (err, docs) => {
                if (docs.length > 0) {
                    var hash = crypto.createHash('sha256');
                    hash.update(`${oInfo.session.username}:${newpassword}:v1`);
                    var password = hash.digest('hex');

                    db.users.update({ _id: oInfo.session.userid }, { $set: { secret: password } }, { }, function (err, numReplaced) {
                        if (numReplaced > 0) {
                            resolve(true);
                        } else {
                            reject(`Changing password auth '${oInfo.session.username}' failed 1`);
                        }
                    });
                } else {
                    reject(`Changing password auth '${oInfo.session.username}' failed 2`);
                }
            });
        });
    }

    listObjects(oInfo, type) {
        return new Promise((resolve, reject) => {
            db[type].find({}, (err, docs) => {
                resolve(docs);
            });
        });
    }

    getObjectByField(oInfo, type, field, content) {
        return new Promise((resolve, reject) => {
            var search = {};
            search[field] = content;
            db[type].find(search, (err, docs) => {
                resolve(docs);
            });
        });
    }

    addOrUpdateObject(oInfo, type, obj) {
        if (obj._id) {
            return this.updateObject(oInfo, type, obj);
        } else {
            return this.addObject(oInfo, type, obj);
        }
    }

    addObject(oInfo, type, obj) {
        return new Promise((resolve, reject) => {
            db[type].insert(obj, (err, docs) => {
                if (err) {
                    reject(`Adding ${type} failed:` + err);
                } else {
                    api.objectChanged(type, obj._id);
                    sendFcmMsg({type});
                    resolve(true);
                }
            });
        });
    }

    updateObject(oInfo, type, obj) {
        return new Promise((resolve, reject) => {
            db[type].update({ _id: obj._id }, { $set: obj }, { }, function (err, numReplaced) {
                if (err || numReplaced < 1) {
                    reject(`Modifying ${type} failed:` + err + " " + numReplaced);
                } else {
                    api.objectChanged(type, obj._id);
                    sendFcmMsg({type});
                    resolve(true);
                }
            });
        });
    }

    deleteObject(oInfo, type, objId) {
        return new Promise((resolve, reject) => {
            db[type].remove({_id : objId}, (err, docs) => {
                api.objectChanged(type, objId);
                sendFcmMsg({type});
                resolve(true);
            });
        });
    }

    userchanged(userid) {
    }

    testsse(oInfo) {
    }
}

class Core {
  Core() {
    this.api = new CoreApi();
    setInterval(() => {
        this.api.testsse(Date.now());
    }, 10000);

    this.plugins = [];
    this.storages = [];
  }

  createWebServer1(bind, port, privkey, fullchain, domains, mapping) {
    this.serverinstance = createWebserver (bind, port, privkey, fullchain, domains, mapping);
  }
}

module.exports = { Core };
