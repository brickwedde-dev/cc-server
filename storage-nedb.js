var Datastore = require('nedb');

const { getBearerFromReq } = require("./authsimple.js");

class StorageNedbPlugin {
  constructor(types, options) {
    this.api = new StorageNedbApi(this, types, options);
  }

  checksession (oInfo, req, res, user, method) {
    return new Promise((resolve, reject) => {
        resolve(true);
    });
  }
}

class StorageNedbApi {
    constructor (plugin, types, options) {
        this.options = options || {};
        this.db = {};
        for(let type of types) {
            this.db[type] = new Datastore({ filename: `./db/${type}.db`, autoload: true });
        }
    }

    listObjects(oInfo, type) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.options.checkListPermission) {
                    await this.options.checkListPermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            this.db[type].find({}, (err, docs) => {
                resolve(docs);
            });
        });
    }

    getObjectByField(oInfo, type, field, content) {
        return new Promise(async (resolve, reject) => {
            try {
                if (oInfo && this.options.checkGetPermission) {
                    await this.options.checkGetPermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            var search = {};
            search[field] = content;
            this.db[type].find(search, (err, docs) => {
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
        return new Promise(async (resolve, reject) => {
            try {
                if (this.options.checkAddPermission) {
                    await this.options.checkAddPermission(oInfo, type, obj);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            this.db[type].insert(obj, (err, obj) => {
                if (!err && obj) {
                    if (this.options.insertedCallback) {
                        this.options.insertedCallback(type, obj._id);
                    }
                    resolve(obj);
                } else {
                    reject(`Adding ${type} failed:` + err);
                }
            });
        });
    }

    updateObject(oInfo, type, obj) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.options.checkUpdatePermission) {
                    await this.options.checkUpdatePermission(oInfo, type, obj);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            this.db[type].update({ _id: obj._id }, { $set: obj }, { }, function (err, numReplaced) {
                if (err || numReplaced < 1) {
                    reject(`Modifying ${type} failed:` + err + " " + numReplaced);
                } else {
                    if (this.options.updatedCallback) {
                        this.options.updatedCallback(type, obj._id);
                    }
                    resolve(true);
                }
            });
        });
    }

    deleteObject(oInfo, type, objId) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.options.checkDeletePermission) {
                    await this.options.checkDeletePermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            db[type].remove({_id : objId}, (err, docs) => {
                if (this.options.deleteCallback) {
                    this.options.deleteCallback(type, objId);
                }
                resolve(true);
            });
        });
    }
}

module.exports = { StorageNedbPlugin };