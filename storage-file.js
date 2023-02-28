const fs = require('fs').promises;
const fssync = require('fs');
const crypto = require('crypto');

class StorageFilePlugin {
  constructor(types, options) {
    this.api = new StorageFileApi(this, types, options);
  }

  checksession (oInfo, req, res, user, method) {
    return new Promise((resolve, reject) => {
        resolve(true);
    });
  }
}

class StorageFileApi {
    constructor (plugin, types, options) {
        this.options = options || {};
        this.db = {};
        for(let type of types) {
            var folder = type.replace(/[/\\?%*:|"<>\\.]/g, '-');
            this.db[type] = `${options.pathprefix}/${folder}/`;
            try {
                fssync.mkdirSync(this.db[type]);
            } catch (e) {
            }
        }
    }

    listObjects(oInfo, type) {
        return new Promise(async (resolve, reject) => {
            try {
                if (oInfo && this.options.checkListPermission) {
                    await this.options.checkListPermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            var aFiles = [];
            var dir = await fs.opendir(this.db[type]);
            for await (const dirent of dir) {
                try {
                    if(dirent.isFile()) {
                        aFiles.push(JSON.parse(await fs.readFile(this.db[type] + "/" + dirent.name)));
                    }
                } catch (e) {
                }
            }
            resolve(aFiles);
        });
    }

    getObjectByField(oInfo, type, field, content) {
        return new Promise(async (resolve, reject) => {
            try {
                if (oInfo && this.options.checkListPermission) {
                    await this.options.checkListPermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            var aFiles = [];
            var dir = await fs.opendir(this.db[type]);
            for await (const dirent of dir) {
                try {
                    if(dirent.isFile()) {
                        var obj = JSON.parse(await fs.readFile(this.db[type] + "/" + dirent.name));
                        if (bj && obj[field] === content) {
                           aFiles.push(obj);
                        }
                    }
                } catch (e) {
                }
            }
            resolve(aFiles);
        });
    }

    addOrUpdateObject(oInfo, type, obj) {
        if (!obj.objectid) {
            return this.addObject(oInfo, type, obj);
        } else {
            return this.updateObject(oInfo, type, obj);
        }
    }

    addObject(oInfo, type, obj) {
        const hash = crypto.createHash('sha256');
        hash.update("" + new Date().getTime());
        obj.objectid = hash.digest('hex');
        return this.updateObject(oInfo, type, obj);
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

            objectid = obj.objectid.replace(/[/\\?%*:|"<>\\.]/g, '-');
            fs.writeFile(this.db[type] + "/" + objectid, JSON.stringify(obj))
            .then(() => {
                resolve(obj);
            })
            .catch((e) => {
                reject(e);
            });
        });
    }

    deleteObject(oInfo, type, objId) {
        return new Promise(async (resolve, reject, objectid) => {
            try {
                if (this.options.checkDeletePermission) {
                    await this.options.checkDeletePermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            objectid = objectid.replace(/[/\\?%*:|"<>\\.]/g, '-');
            try {
                await fs.unlink(this.db[type] + "/" + objectid);
                resolve(true);
            } catch (e) {
            }
            reject();
        });
    }
}

module.exports = { StorageFilePlugin };